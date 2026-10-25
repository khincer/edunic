import Redis from 'ioredis';
import type { EventEnvelope } from '@edunic/source/events';
import {
  closeTestDatabase,
  createTestApp,
  resetTestDatabase,
  createInstitutionFixture,
  createUserFixture,
} from '@edunic/source/testing/api-helpers';
import { bootstrapWorker } from '../../src/bootstrap.js';

// Task 7.3 (P5-R2, P5-R3; design D3/D2 data flow): the full workflow
// POST /enrollments -> enrollment.created (Redis XADD) -> worker consumer
// group -> enrollment.welcomed, including the at-least-once guarantee that
// the same event delivered twice produces exactly ONE side effect.
// EVENT_BUS_BACKEND=redis is wired in test/setup-env.cjs so the API app under
// test publishes through RedisStreamsEventBus, not the in-memory bus.
const STREAM = 'edunic:domain-events';
const GROUP = 'edunic-worker';
// The email runtime is incidental to this flow, but bootstrapWorker now builds
// it: a test-scoped queue name/prefix keeps the suite off production-named keys.
const EMAIL_QUEUE_NAME = `email-delivery-workflow-test-${process.pid}`;
const EMAIL_QUEUE_PREFIX = 'edunic:email-workflow-test';

describe('workflow: enrollment.created -> worker -> enrollment.welcomed', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let redis: Redis;
  let runtime: ReturnType<typeof bootstrapWorker>;
  let consumer: ReturnType<typeof bootstrapWorker>['consumer'];
  let institutionId: string;
  let headers: Record<string, string>;
  let studentId: string;
  let academicPeriodId: string;

  const readStream = async (): Promise<EventEnvelope[]> => {
    const entries = (await redis.call('XRANGE', STREAM, '-', '+')) as Array<
      [string, Array<string>]
    > | null;

    return (entries ?? []).map(([, fields]) => {
      const eventIndex = fields.findIndex((field) => field === 'event');
      return JSON.parse(fields[eventIndex + 1]) as EventEnvelope;
    });
  };

  const pendingEntryIds = async (): Promise<string[]> => {
    const pending = (await redis.xpending(
      STREAM,
      GROUP,
      '-',
      '+',
      10
    )) as Array<[string, string, string, number]> | null;
    return pending?.map((entry) => entry[0]) ?? [];
  };

  const welcomesFor = async (enrollmentId: string) =>
    (await readStream()).filter(
      (event) =>
        event.name === 'enrollment.welcomed' &&
        (event.payload as { enrollmentId?: string }).enrollmentId ===
          enrollmentId
    );

  const createEnrollment = async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/enrollments',
      headers,
      payload: { studentId, academicPeriodId, status: 'active' },
    });
    expect(created.statusCode).toBe(201);
    return created.json().data as { id: string };
  };

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: 1,
    });
    await redis.del(STREAM);

    app = await createTestApp();

    const boot = bootstrapWorker({
      ...process.env,
      EMAIL_QUEUE_NAME,
      EMAIL_QUEUE_PREFIX,
    });
    runtime = boot;
    consumer = boot.consumer;
    // Worker joins before the write: the group starts at the stream tip.
    await consumer.ensureGroup();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    // Fresh stream per test: production names, deterministic assertions.
    await redis.del(STREAM);
    await consumer.ensureGroup();

    const institution = await createInstitutionFixture('Workflow Institution');
    institutionId = institution.id;

    const admin = await createUserFixture({
      institutionId,
      role: 'director',
      email: 'workflow-admin@worker.test',
      password: 'admin1234',
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: admin.email,
        password: admin.password,
        institutionId,
      },
    });
    expect(login.statusCode).toBe(200);

    headers = {
      authorization: `Bearer ${login.json().data.token}`,
      'x-institution-id': institutionId,
    };

    const period = await app.inject({
      method: 'POST',
      url: '/academic-periods',
      headers,
      payload: {
        year: 2026,
        term: 1,
        startDate: '2026-01-15',
        endDate: '2026-03-31',
      },
    });
    expect(period.statusCode).toBe(201);
    academicPeriodId = period.json().data.id;

    const student = await app.inject({
      method: 'POST',
      url: '/students',
      headers,
      payload: {
        firstName: 'Wren',
        lastName: 'Vasquez',
        dateOfBirth: '2011-04-19',
      },
    });
    expect(student.statusCode).toBe(201);
    studentId = student.json().data.id;
  });

  afterAll(async () => {
    consumer?.close();
    // bootstrapWorker now owns a queue, a worker and a pool: close them in the
    // order the worker's own shutdown uses (queue/worker before the pool).
    await runtime?.emailWorker.close();
    await runtime?.emailQueue.close();
    await runtime?.pool.end();
    await app.close();
    await closeTestDatabase();
    redis.disconnect();
  });

  it('flows POST /enrollments through the worker to enrollment.welcomed (P5-R2)', async () => {
    const enrollment = await createEnrollment();

    // The API published enrollment.created to the real stream via XADD.
    const onStream = await readStream();
    expect(onStream).toHaveLength(1);
    expect(onStream[0].name).toBe('enrollment.created');
    const created = onStream[0];
    // New enrollment.created events no longer carry the field (S1.4e-2).
    expect(created).not.toHaveProperty('institutionId');
    expect(created.payload).toMatchObject({
      enrollmentId: enrollment.id,
      studentId,
      academicPeriodId,
    });

    // The worker consumes it from its consumer group...
    const processed = await consumer.pollOnce({ blockMs: 0 });
    expect(processed).toBeGreaterThanOrEqual(1);

    // ...and its side effect, enrollment.welcomed, lands on the same stream.
    const welcomes = await welcomesFor(enrollment.id);
    expect(welcomes).toHaveLength(1);
    // New side effects no longer carry the field (S1.4c).
    expect(welcomes[0]).not.toHaveProperty('institutionId');
    expect(welcomes[0].payload).toMatchObject({
      enrollmentId: enrollment.id,
      studentId,
    });
    expect(welcomes[0].id).not.toBe(created.id);

    // The consumed delivery was acked: nothing left pending.
    expect(await pendingEntryIds()).toEqual([]);
  });

  it('produces exactly ONE side effect when the same event is delivered twice (P5-R3)', async () => {
    const enrollment = await createEnrollment();

    const created = (await readStream())[0];
    expect(created.name).toBe('enrollment.created');
    const createdRaw = JSON.stringify(created);

    // First delivery: the welcome side effect runs once.
    await consumer.pollOnce({ blockMs: 0 });
    expect(await welcomesFor(enrollment.id)).toHaveLength(1);

    // Second delivery of the SAME event (same event id) — the at-least-once
    // duplicate the dedupe marker must absorb.
    await redis.xadd(STREAM, '*', 'event', createdRaw);
    await consumer.pollOnce({ blockMs: 0 });

    // Assertion: exactly one side effect despite two deliveries.
    expect(await welcomesFor(enrollment.id)).toHaveLength(1);

    // Dedupe marker present for the event id; duplicate was acked, not looped.
    expect(await redis.exists(`processed:${created.id}`)).toBe(1);
    expect(await pendingEntryIds()).toEqual([]);

    // The stream holds: 1 created + 1 created(duplicate) + 1 welcomed.
    const names = (await readStream()).map((event) => event.name);
    expect(names.filter((name) => name === 'enrollment.created')).toHaveLength(2);
    expect(names.filter((name) => name === 'enrollment.welcomed')).toHaveLength(1);
  });

  it('never re-publishes a welcome for an event id already processed in a previous run', async () => {
    const enrollment = await createEnrollment();
    const created = (await readStream())[0];

    // Run 1: consume and complete.
    await consumer.pollOnce({ blockMs: 0 });
    expect(await welcomesFor(enrollment.id)).toHaveLength(1);

    // Marker exists even though the group entry was acked; a fresh duplicate
    // delivery (e.g. replay after data loss) stays a no-op.
    await redis.xadd(STREAM, '*', 'event', JSON.stringify(created));
    await consumer.pollOnce({ blockMs: 0 });
    await consumer.pollOnce({ blockMs: 0 });

    expect(await welcomesFor(enrollment.id)).toHaveLength(1);
  });

  // Events already on the stream when the sweep deploys still carry the
  // tenant field. The consumer must handle and ack them, and the side effect
  // must not propagate the field (TEN-07).
  it('consumes an old-shape enrollment.created that still carries institutionId', async () => {
    const enrollment = await createEnrollment();
    const created = (await readStream())[0];
    await redis.del(STREAM);
    await consumer.ensureGroup();

    const oldShape = {
      ...created,
      id: 'old-shape-event-queued-before-the-sweep',
      institutionId: institutionId,
    };
    await redis.xadd(STREAM, '*', 'event', JSON.stringify(oldShape));

    expect(await consumer.pollOnce({ blockMs: 0 })).toBe(1);

    const welcomes = await welcomesFor(enrollment.id);
    expect(welcomes).toHaveLength(1);
    expect(welcomes[0]).not.toHaveProperty('institutionId');
    expect(await redis.exists(`processed:${oldShape.id}`)).toBe(1);
    expect(await pendingEntryIds()).toEqual([]);
  });
});
