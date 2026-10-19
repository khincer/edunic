import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { createEnrollmentWelcomedEvent } from '@edunic/source/domain/events';
import {
  emailJobId,
  type EmailDeliveryJob,
} from '@edunic/source/domain/notifications';
import { db } from '@edunic/source/db';
import { studentGuardians } from '@edunic/source/db/schema';
import {
  closeTestDatabase,
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  ensureTestDatabaseReady,
  resetTestDatabase,
} from '@edunic/source/testing/api-helpers';
import { bootstrapWorker, type WorkerRuntime } from '../../src/bootstrap.js';
import {
  createEmailQueue,
  EMAIL_JOB_NAME,
} from '../../src/email/bullmq-email-queue.js';
import { FakeEmailTransport } from '../helpers/fake-email-transport.js';

// Task 5.1 (OC-R1, DR-R1): the ledger's claim guard is the job's first write —
// `status in ('queued','retried') -> 'sending'` — and a claim that affects no
// row means "do not send" (design D2). The three cases below close the OC-R1
// paths the queue-level suite cannot: a row that is already final, a job that
// was evicted while its row is still awaiting, and two jobs for one row.
// Real Postgres, real Redis and a real BullMQ Worker; the provider is the only
// substitute, behind the injected EmailTransport port.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE_NAME = `email-idempotency-test-${randomUUID()}`;
const QUEUE_PREFIX = 'edunic:email-idempotency-test';
const FROM_ADDRESS = 'no-reply@edunic.test';
const PLATFORM_REPLY_TO = 'support@edunic.test';

type DeliveryRow = {
  recipientAddress: string;
  status: string;
  attemptCount: number;
  providerMessageId: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('worker email delivery idempotency', () => {
  let redis: Redis;
  let runtime: WorkerRuntime;
  let queue: Queue;
  let fake: FakeEmailTransport;
  // Same as the delivery suite: obliterate races the idle worker's blocking
  // read, so the errors are recorded and never asserted.
  const workerErrors: Error[] = [];

  const workerEnv = (): NodeJS.ProcessEnv => ({
    EVENT_BUS_BACKEND: 'redis',
    REDIS_URL,
    DATABASE_URL: process.env.DATABASE_URL as string,
    RESEND_API_KEY: 'test-resend-key',
    EMAIL_FROM_ADDRESS: FROM_ADDRESS,
    EMAIL_REPLY_TO: PLATFORM_REPLY_TO,
    EMAIL_QUEUE_NAME: QUEUE_NAME,
    EMAIL_QUEUE_PREFIX: QUEUE_PREFIX,
  });

  const readDeliveries = async (
    institutionId: string
  ): Promise<DeliveryRow[]> => {
    const result = await db.execute<DeliveryRow>(sql`
      select
        recipient_address as "recipientAddress",
        status,
        attempt_count as "attemptCount",
        provider_message_id as "providerMessageId"
      from email_deliveries
      where institution_id = ${institutionId}
      order by recipient_address asc
    `);

    return result.rows;
  };

  const waitForDeliveries = async (
    institutionId: string,
    expected: { status: string; count: number },
    timeoutMs = 10000
  ): Promise<DeliveryRow[]> => {
    const deadline = Date.now() + timeoutMs;
    let rows: DeliveryRow[] = [];

    while (Date.now() < deadline) {
      rows = await readDeliveries(institutionId);
      if (
        rows.length === expected.count &&
        rows.every((row) => row.status === expected.status)
      ) {
        return rows;
      }
      await sleep(25);
    }

    throw new Error(
      `timed out waiting for ${expected.count} ${expected.status} deliveries; last read: ${JSON.stringify(rows)}`
    );
  };

  const waitForJobEnd = async (
    jobId: string,
    timeoutMs = 10000
  ): Promise<string> => {
    const deadline = Date.now() + timeoutMs;
    let state = 'missing';

    while (Date.now() < deadline) {
      const job = await queue.getJob(jobId);
      if (job) {
        state = await job.getState();
        if (state === 'completed' || state === 'failed') {
          return state;
        }
      } else {
        state = 'missing';
      }
      await sleep(25);
    }

    throw new Error(`timed out waiting for job ${jobId}; last state: ${state}`);
  };

  const createScenario = async () => {
    const institution = await createInstitutionFixture('Idempotency School');

    await db.execute(sql`
      update institutions
      set sender_name = 'Central School'
      where id = ${institution.id}
    `);
    await db.execute(sql`
      insert into institution_feature_flags (
        institution_id,
        feature_key,
        enabled
      )
      values (${institution.id}, 'email_notifications', true)
      on conflict (institution_id, feature_key) do update set enabled = true
    `);

    const period = await createAcademicPeriodFixture({
      institutionId: institution.id,
    });
    const student = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'Wren',
      lastName: 'Vasquez',
    });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const guardian = await createGuardianFixture({
      institutionId: institution.id,
      email: 'maria@example.com',
    });
    await db
      .insert(studentGuardians)
      .values({ studentId: student.id, guardianId: guardian.id });

    return {
      institutionId: institution.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
    };
  };

  const deliveryJob = (
    scenario: { institutionId: string; enrollmentId: string },
    eventId: string,
    recipientAddress = 'maria@example.com'
  ): EmailDeliveryJob => ({
    institutionId: scenario.institutionId,
    eventId,
    recipientAddress,
    from: FROM_ADDRESS,
    replyTo: PLATFORM_REPLY_TO,
    to: recipientAddress,
    subject: 'Welcome to Central School',
    text: 'Hello,',
  });

  // A job for the same ledger row that escapes the deterministic id — an
  // operator replay, a queue restored from a dump, or a duplicate produced by
  // another producer. The claim guard, not the job id, is what must stop it.
  const addDuplicateJob = async (job: EmailDeliveryJob): Promise<string> => {
    const jobId = `email-duplicate-${randomUUID()}`;
    await queue.add(EMAIL_JOB_NAME, job, { jobId });

    return jobId;
  };

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    await ensureTestDatabaseReady();

    fake = new FakeEmailTransport();
    runtime = bootstrapWorker(workerEnv(), { emailTransport: fake });
    runtime.emailWorker.on('error', (error) => workerErrors.push(error));

    queue = createEmailQueue({
      redisUrl: REDIS_URL,
      queueName: QUEUE_NAME,
      prefix: QUEUE_PREFIX,
    });

    await runtime.emailWorker.waitUntilReady();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await redis.del('edunic:domain-events');
    await runtime.consumer.ensureGroup();
    fake.reset();
  });

  afterEach(async () => {
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await runtime.emailWorker.close();
    await runtime.emailQueue.close();
    await queue.close();
    runtime.consumer.close();
    await runtime.pool.end();
    await closeTestDatabase();
    redis.disconnect();
  });

  it('OC-R1: a ledger row that is already sent is never sent again', async () => {
    const scenario = await createScenario();
    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });

    await redis.xadd('edunic:domain-events', '*', 'event', JSON.stringify(event));
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);

    const delivered = await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });
    expect(fake.calls).toBe(1);

    // A duplicate job reaches the processor for a row that is already final.
    fake.reset();
    const duplicateId = await addDuplicateJob(
      deliveryJob(scenario, event.id)
    );
    expect(await waitForJobEnd(duplicateId)).toBe('completed');

    // No transport call at all: the claim affects no row, so nothing is sent.
    expect(fake.calls).toBe(0);
    const rows = await readDeliveries(scenario.institutionId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sent');
    expect(rows[0].providerMessageId).toBe(delivered[0].providerMessageId);
    expect(rows[0].attemptCount).toBe(1);
  });

  it('OC-R1: replaying an evicted job sends the awaiting row exactly once', async () => {
    const scenario = await createScenario();
    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    const jobId = emailJobId(event.id, 'maria@example.com');

    // Staged with the worker stopped so the row-then-job order of enqueue is
    // observable: the ledger row lands first (D2), then the job record is
    // evicted before it is ever processed.
    await runtime.emailWorker.pause();
    await runtime.emailDelivery.enqueueForEvent(event);

    const staged = await waitForDeliveries(scenario.institutionId, {
      status: 'queued',
      count: 1,
    });
    expect(staged[0].attemptCount).toBe(0);
    const job = await queue.getJob(jobId);
    expect(job).toBeDefined();
    await job?.remove();
    expect(await queue.getJob(jobId)).toBeUndefined();

    // The replay re-adds the evicted job; the row is still `queued`, so the
    // claim admits it and the delivery completes.
    await runtime.emailDelivery.enqueueForEvent(event);
    await runtime.emailWorker.resume();
    expect(await waitForJobEnd(jobId)).toBe('completed');

    const rows = await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });
    expect(fake.calls).toBe(1);
    expect(rows[0].providerMessageId).not.toBeNull();
    // One claim, one attempt.
    expect(rows[0].attemptCount).toBe(1);
  });

  it('OC-R1: two jobs for one ledger row produce a single send', async () => {
    const scenario = await createScenario();
    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    const job = deliveryJob(scenario, event.id);

    // `queued` is the non-final state both jobs race for.
    await runtime.emailWorker.pause();
    await runtime.emailDelivery.enqueueForEvent(event);
    const [queued] = await waitForDeliveries(scenario.institutionId, {
      status: 'queued',
      count: 1,
    });
    expect(queued.attemptCount).toBe(0);

    const duplicateId = await addDuplicateJob(job);
    // Both are admitted to the worker together, so the guard is what decides.
    await runtime.emailWorker.resume();

    expect(await waitForJobEnd(duplicateId)).toBe('completed');

    const rows = await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });
    expect(fake.calls).toBe(1);
    expect(rows[0].attemptCount).toBe(1);
  });
});
