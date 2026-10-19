import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import {
  createAttendanceMarkedEvent,
  createEnrollmentWelcomedEvent,
  createGradeSubmittedEvent,
} from '@edunic/source/domain/events';
import { emailJobId, type EmailDeliveryJob } from '@edunic/source/domain/notifications';
import { db } from '@edunic/source/db';
import { guardianUserLinks, studentGuardians } from '@edunic/source/db/schema';
import {
  closeTestDatabase,
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createTestApp,
  createUserFixture,
  ensureTestDatabaseReady,
  resetTestDatabase,
} from '@edunic/source/testing/api-helpers';
import { bootstrapWorker, type WorkerRuntime } from '../../src/bootstrap.js';
import {
  createEmailQueue,
  EMAIL_JOB_ATTEMPTS,
  EMAIL_JOB_KEEP_COMPLETED_MS,
  EMAIL_JOB_KEEP_FAILED_MS,
} from '../../src/email/bullmq-email-queue.js';
import { FakeEmailTransport } from '../helpers/fake-email-transport.js';

// Task 4.4 (EV-R1, RC-R1, RC-R2, RC-R3, OC-R1, FL-R2, SI-R3, RS-R1, DR-R1,
// DR-R2): the email path runs against real Postgres, a real Redis and a real
// BullMQ Worker — the only substitute is the provider, behind the injected
// EmailTransport port. A unique queue name per suite plus obliterate keeps the
// suite off every other queue in the shared Redis.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const STREAM = 'edunic:domain-events';
const QUEUE_NAME = `email-delivery-test-${randomUUID()}`;
const QUEUE_PREFIX = 'edunic:email-test';
const FROM_ADDRESS = 'no-reply@edunic.test';
const PLATFORM_REPLY_TO = 'support@edunic.test';

type DeliveryRow = {
  recipientAddress: string;
  recipientSource: string;
  status: string;
  attemptCount: number;
  providerMessageId: string | null;
  providerError: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('worker email delivery', () => {
  let redis: Redis;
  let runtime: WorkerRuntime;
  let queue: Queue;
  let fake: FakeEmailTransport;
  // Obliterating between cases races the idle worker's blocking read; the
  // errors are recorded so they cannot crash the run, and are not asserted.
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

  const publish = (event: unknown) =>
    redis.xadd(STREAM, '*', 'event', JSON.stringify(event));

  const countJobs = async (): Promise<number> => {
    const jobs = await queue.getJobs([
      'wait',
      'active',
      'completed',
      'failed',
      'delayed',
      'prioritized',
      'waiting-children',
    ]);
    return jobs.length;
  };

  const readDeliveries = async (
    institutionId: string
  ): Promise<DeliveryRow[]> => {
    const result = await db.execute<DeliveryRow>(sql`
      select
        recipient_address as "recipientAddress",
        recipient_source as "recipientSource",
        status,
        attempt_count as "attemptCount",
        provider_message_id as "providerMessageId",
        provider_error as "providerError"
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

  const createScenario = async (
    options: {
      senderName?: string | null;
      replyToEmail?: string | null;
      enabled?: boolean;
    } = {}
  ) => {
    const institution = await createInstitutionFixture('Email Institution');

    if (options.senderName !== null) {
      await db.execute(sql`
        update institutions
        set sender_name = ${options.senderName ?? 'Central School'},
            reply_to_email = ${options.replyToEmail ?? null}
        where id = ${institution.id}
      `);
    }

    if (options.enabled !== false) {
      await db.execute(sql`
        insert into institution_feature_flags (
          institution_id,
          feature_key,
          enabled
        )
        values (${institution.id}, 'email_notifications', true)
        on conflict (institution_id, feature_key) do update set enabled = true
      `);
    }

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

    return {
      institutionId: institution.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
    };
  };

  const addGuardian = async (
    institutionId: string,
    studentId: string,
    email: string | null
  ) => {
    const guardian = await createGuardianFixture({ institutionId, email });
    await db
      .insert(studentGuardians)
      .values({ studentId, guardianId: guardian.id });

    return guardian;
  };

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    await ensureTestDatabaseReady();

    fake = new FakeEmailTransport();
    runtime = bootstrapWorker(workerEnv(), { emailTransport: fake });
    runtime.emailWorker.on('error', (error) => workerErrors.push(error));

    // A separate handle on the same queue for the OC-R1 assertions.
    queue = createEmailQueue({
      redisUrl: REDIS_URL,
      queueName: QUEUE_NAME,
      prefix: QUEUE_PREFIX,
    });

    await runtime.emailWorker.waitUntilReady();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    // Fresh stream per case (the consumer group starts at the stream tip).
    await redis.del(STREAM);
    await runtime.consumer.ensureGroup();
    fake.reset();
  });

  afterEach(async () => {
    // Drops completed and scheduled-retry job records so no case can inherit
    // another one's jobs.
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

  it('enqueues one delivery per distinct address and sends each exactly once (EV-R1, RC-R1, RC-R2)', async () => {
    const scenario = await createScenario();
    // Two guardians on record share one address (differing only in case); the
    // third has no email and reaches the second address through a linked user.
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'Maria@Example.com'
    );
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );
    const silentGuardian = await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      null
    );
    const linkedUser = await createUserFixture({
      institutionId: scenario.institutionId,
      role: 'parent',
      email: 'Dad@Example.com',
    });
    await db.insert(guardianUserLinks).values({
      institutionId: scenario.institutionId,
      guardianId: silentGuardian.id,
      userId: linkedUser.id,
    });

    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    await publish(event);

    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);

    const rows = await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 2,
    });

    // RC-R2: one row per distinct address, with the guardian on record winning
    // the shared one; RC-R1: the linked user supplies the second address.
    expect(rows.map((row) => row.recipientAddress)).toEqual([
      'dad@example.com',
      'maria@example.com',
    ]);
    expect(rows.map((row) => row.recipientSource)).toEqual([
      'user',
      'guardian',
    ]);
    expect(rows.every((row) => row.providerMessageId !== null)).toBe(true);

    expect(fake.calls).toBe(2);
    expect(fake.sent.map((message) => message.to).sort()).toEqual([
      'dad@example.com',
      'maria@example.com',
    ]);
    expect(fake.sent[0].from).toBe(FROM_ADDRESS);
    expect(fake.sent[0].replyTo).toBe(PLATFORM_REPLY_TO);
    expect(fake.sent[0].subject).toBe('Welcome to Central School');
    expect(fake.sent[0].text).toContain('Wren Vasquez');

    // The deterministic job id (D2, corrected: BullMQ forbids ':' in custom
    // ids) and the queue policy travel with the job.
    const jobId = emailJobId(event.id, 'maria@example.com');
    expect(jobId).toMatch(/^email-[0-9a-f-]{36}-[0-9a-f]{64}$/);
    expect(jobId).not.toContain(':');
    const job = await queue.getJob(jobId);
    expect(job?.id).toBe(jobId);
    expect(job?.opts.attempts).toBe(EMAIL_JOB_ATTEMPTS);
    expect(job?.opts.removeOnComplete).toEqual({
      age: EMAIL_JOB_KEEP_COMPLETED_MS,
    });
    expect(job?.opts.removeOnFail).toEqual({ age: EMAIL_JOB_KEEP_FAILED_MS });
  });

  it('sends a grade notice for grade.submitted using the institution reply-to (EV-R1, SI-R1)', async () => {
    const scenario = await createScenario({
      senderName: 'North School',
      replyToEmail: 'academics@north.test',
    });
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );

    await publish(
      createGradeSubmittedEvent({
        institutionId: scenario.institutionId,
        payload: {
          gradeId: randomUUID(),
          enrollmentId: scenario.enrollmentId,
          subject: 'Mathematics',
          score: 91,
        },
      })
    );

    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);
    await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });

    expect(fake.calls).toBe(1);
    expect(fake.sent[0].subject).toBe('Grade published for Wren Vasquez');
    expect(fake.sent[0].text).toContain('Course: Mathematics');
    expect(fake.sent[0].text).toContain('Score: 91');
    expect(fake.sent[0].replyTo).toBe('academics@north.test');
  });

  it('sends an absence notice for attendance.marked (EV-R1)', async () => {
    const scenario = await createScenario();
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );

    await publish(
      createAttendanceMarkedEvent({
        institutionId: scenario.institutionId,
        payload: {
          attendanceId: randomUUID(),
          enrollmentId: scenario.enrollmentId,
          date: '2026-02-03',
          status: 'absent',
        },
      })
    );

    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);
    await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });

    expect(fake.calls).toBe(1);
    expect(fake.sent[0].subject).toBe('Absence recorded for Wren Vasquez');
    expect(fake.sent[0].text).toContain('on 2026-02-03');
  });

  it('resolves no recipients and does not fail when the guardian has no email and no linked user (RS-R1)', async () => {
    const scenario = await createScenario();
    await addGuardian(scenario.institutionId, scenario.studentId, null);

    await publish(
      createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      })
    );

    // The handler completed, so the entry is acked and stays acked.
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);
    await sleep(150);

    expect(await readDeliveries(scenario.institutionId)).toEqual([]);
    expect(await countJobs()).toBe(0);
    expect(fake.calls).toBe(0);
  });

  it('OC-R1: a duplicate stream entry produces exactly one send', async () => {
    const scenario = await createScenario();
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );

    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    const raw = JSON.stringify(event);

    await redis.xadd(STREAM, '*', 'event', raw);
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);

    // Redelivery of the same envelope: absorbed, acked, no second side effect.
    await redis.xadd(STREAM, '*', 'event', raw);
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(0);

    const rows = await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });
    expect(rows[0].recipientAddress).toBe('maria@example.com');
    expect(await countJobs()).toBe(1);
    expect(fake.calls).toBe(1);
  });

  it('OC-R1: an identical jobId already present adds no new job', async () => {
    const scenario = await createScenario();
    const eventId = randomUUID();
    const delivery: EmailDeliveryJob = {
      institutionId: scenario.institutionId,
      eventId,
      recipientAddress: 'maria@example.com',
      from: FROM_ADDRESS,
      replyTo: PLATFORM_REPLY_TO,
      to: 'maria@example.com',
      subject: 'Welcome to Central School',
      text: 'Hello,',
    };

    // The claim guard (P5/D2) sends only for a row the ledger already holds, so
    // the row this job belongs to is staged exactly as `enqueueForEvent` writes
    // it. Stages the fixture only — every assertion below is unchanged.
    await db.execute(sql`
      insert into email_deliveries (
        institution_id,
        event_id,
        event_name,
        recipient_address,
        recipient_source,
        student_id
      )
      values (
        ${scenario.institutionId},
        ${eventId},
        'enrollment.welcomed',
        'maria@example.com',
        'guardian',
        ${scenario.studentId}
      )
    `);

    await runtime.emailQueue.enqueue(delivery);
    await runtime.emailQueue.enqueue({ ...delivery });

    const jobId = emailJobId(eventId, 'maria@example.com');
    expect(await queue.getJob(jobId)).toBeDefined();
    expect(await countJobs()).toBe(1);

    const deadline = Date.now() + 10000;
    while (fake.calls === 0 && Date.now() < deadline) {
      await sleep(25);
    }

    expect(fake.calls).toBe(1);
    expect(await countJobs()).toBe(1);
  });

  it('OC-R1: re-enqueuing the same event is a no-op, not an error', async () => {
    const scenario = await createScenario();
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );

    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });

    await publish(event);
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);
    await waitForDeliveries(scenario.institutionId, {
      status: 'sent',
      count: 1,
    });

    // The ledger insert conflicts and the job id already exists: neither is an
    // error and neither produces a second send.
    await expect(
      runtime.emailDelivery.enqueueForEvent(event)
    ).resolves.toBeUndefined();
    await sleep(150);

    const rows = await readDeliveries(scenario.institutionId);
    expect(rows).toHaveLength(1);
    expect(await countJobs()).toBe(1);
    expect(fake.calls).toBe(1);
  });

  it('FL-R2: with the flag off nothing is enqueued and nothing is sent', async () => {
    const scenario = await createScenario({ enabled: false });
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );

    await publish(
      createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      })
    );

    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);
    await sleep(150);

    expect(await readDeliveries(scenario.institutionId)).toEqual([]);
    expect(await countJobs()).toBe(0);
    expect(fake.calls).toBe(0);
  });

  it('SI-R3: an institution without a sender identity enqueues and sends nothing', async () => {
    const scenario = await createScenario({ senderName: null });
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );

    await publish(
      createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      })
    );

    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);
    await sleep(150);

    expect(await readDeliveries(scenario.institutionId)).toEqual([]);
    expect(await countJobs()).toBe(0);
    expect(fake.calls).toBe(0);
  });

  it('DR-R1: a retryable provider failure is recorded as retried and retried', async () => {
    const scenario = await createScenario();
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );
    fake.failRetryable('provider 503 unavailable');

    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    await publish(event);
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);

    const rows = await waitForDeliveries(scenario.institutionId, {
      status: 'retried',
      count: 1,
    });
    expect(rows[0].providerError).toContain('503');
    expect(rows[0].providerMessageId).toBeNull();
    expect(fake.calls).toBe(1);

    // The job survives its failure to be retried under the same id.
    const job = await queue.getJob(emailJobId(event.id, 'maria@example.com'));
    expect(job).toBeDefined();
    expect(job?.attemptsMade).toBe(1);
  });

  it('DR-R1: a non-retryable provider failure is recorded as failed and not retried', async () => {
    const scenario = await createScenario();
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );
    fake.failNonRetryable('provider 422 invalid from address');

    await publish(
      createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      })
    );
    expect(await runtime.consumer.pollOnce({ blockMs: 0 })).toBe(1);

    const rows = await waitForDeliveries(scenario.institutionId, {
      status: 'failed',
      count: 1,
    });
    expect(rows[0].providerError).toContain('422');

    await sleep(300);
    expect(fake.calls).toBe(1);
  });

  it('RS-R1: the originating enrollment write survives a failing email path', async () => {
    const scenario = await createScenario();
    await addGuardian(
      scenario.institutionId,
      scenario.studentId,
      'maria@example.com'
    );
    const admin = await createUserFixture({
      institutionId: scenario.institutionId,
      role: 'admin',
      email: 'rsr1-admin@worker.test',
      password: 'admin1234',
    });
    fake.failRetryable('provider 503 unavailable');

    const app = await createTestApp();
    try {
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: admin.email,
          password: admin.password,
          institutionId: scenario.institutionId,
        },
      });
      expect(login.statusCode).toBe(200);
      const headers = {
        authorization: `Bearer ${login.json().data.token}`,
        'x-institution-id': scenario.institutionId,
      };

      const period = await app.inject({
        method: 'POST',
        url: '/academic-periods',
        headers,
        payload: {
          year: 2026,
          term: 2,
          startDate: '2026-05-01',
          endDate: '2026-07-31',
        },
      });
      expect(period.statusCode).toBe(201);

      const created = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers,
        payload: {
          studentId: scenario.studentId,
          academicPeriodId: period.json().data.id,
          status: 'active',
        },
      });
      expect(created.statusCode).toBe(201);
      const enrollmentId = created.json().data.id as string;

      // The worker turns enrollment.created into enrollment.welcomed, then the
      // email path fails at the provider.
      expect(
        await runtime.consumer.pollOnce({ blockMs: 0 })
      ).toBeGreaterThanOrEqual(1);
      expect(
        await runtime.consumer.pollOnce({ blockMs: 0 })
      ).toBeGreaterThanOrEqual(1);
      const rows = await waitForDeliveries(scenario.institutionId, {
        status: 'retried',
        count: 1,
      });
      expect(rows[0].providerError).toContain('503');

      // The originating write committed regardless.
      const stored = await db.execute<{ status: string }>(sql`
        select status from enrollments where id = ${enrollmentId}
      `);
      expect(stored.rows).toEqual([{ status: 'active' }]);
    } finally {
      await app.close();
    }
  });
});
