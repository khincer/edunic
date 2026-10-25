import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { createEnrollmentWelcomedEvent } from '@edunic/source/domain/events';
import {
  EmailDeliveriesRepository,
  emailJobId,
  reclaimJobId,
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
import { createEmailClaimSweeper } from '../../src/email/email-claim-sweeper.js';
import { FakeEmailTransport } from '../helpers/fake-email-transport.js';

// Task 5.1 (OC-R1, DR-R1): the ledger's claim guard is the job's first write —
// `status in ('queued','retried') -> 'sending'` — and a claim that affects no
// row means "do not send" (design D2). The three cases below close the OC-R1
// paths the queue-level suite cannot: a row that is already final, a job that
// was evicted while its row is still awaiting, and two jobs for one row. The
// last three cover the other half of the guard: a claim that is never completed
// (P8), which the sweeper has to reclaim.
// P9 adds the window the reclaim itself opened: a send that outlives the
// threshold must be cut off by its deadline rather than reclaimed and re-sent,
// a stranded row whose job record is gone must not be advertised as a pending
// retry, and the reclaim must work through its production timer path.
// P10 adds the last window of that kind: a send the provider accepted and the
// ledger never recorded, which a reclaim re-sends. The deadline cannot close
// it (the send is over), so the retry carries the delivery row's provider key
// and the provider absorbs it — one message, not two.
// Real Postgres, real Redis and a real BullMQ Worker; the provider is the only
// substitute, behind the injected EmailTransport port.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const QUEUE_NAME = `email-idempotency-test-${randomUUID()}`;
const QUEUE_PREFIX = 'edunic:email-idempotency-test';
const FROM_ADDRESS = 'no-reply@edunic.test';
const PLATFORM_REPLY_TO = 'support@edunic.test';
const RECIPIENT = 'maria@example.com';
// The reclaim threshold is above the send deadline by the shipped safety
// factor, so a claim that is still inside its own send is never stale.
const CLAIM_STALE_MS = 1_500;
const SEND_TIMEOUT_MS = 500;
// A provider response slower than the deadline: it is still in flight when the
// threshold passes, which is the window the deadline has to close.
const HANG_MS = 3_000;
const HOUR_MS = 60 * 60 * 1000;

type DeliveryRow = {
  id: string;
  recipientAddress: string;
  status: string;
  attemptCount: number;
  providerMessageId: string | null;
  providerError: string | null;
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
    EMAIL_CLAIM_STALE_MS: String(CLAIM_STALE_MS),
    EMAIL_SEND_TIMEOUT_MS: String(SEND_TIMEOUT_MS),
  });

  const readDeliveries = async (
    institutionId: string
  ): Promise<DeliveryRow[]> => {
    const result = await db.execute<DeliveryRow>(sql`
      select
        id,
        recipient_address as "recipientAddress",
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
      update feature_flags set default_value = true
      where key = 'email_notifications'
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

  // A second address for the same student, resolved exactly as production
  // resolves the first one (RC-R1).
  const addGuardian = async (
    institutionId: string,
    studentId: string,
    email: string
  ): Promise<void> => {
    const guardian = await createGuardianFixture({ institutionId, email });
    await db
      .insert(studentGuardians)
      .values({ studentId, guardianId: guardian.id });
  };

  const deliveryJob = (
    scenario: { institutionId: string; enrollmentId: string },
    eventId: string,
    recipientAddress = RECIPIENT
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

  // The end state a worker that died between the claim and the completion write
  // leaves behind: the row is stuck in 'sending' and its claim is `ageMs` old.
  const stageStrandedRow = async (input: {
    institutionId: string;
    eventId: string;
    studentId: string;
    ageMs: number;
  }): Promise<void> => {
    await db.execute(sql`
      insert into email_deliveries (
        institution_id,
        event_id,
        event_name,
        recipient_address,
        recipient_source,
        student_id,
        status,
        attempt_count,
        updated_at
      )
      values (
        ${input.institutionId},
        ${input.eventId},
        'enrollment.welcomed',
        ${RECIPIENT},
        'guardian',
        ${input.studentId},
        'sending',
        1,
        now() - make_interval(secs => ${input.ageMs / 1000})
      )
    `);
  };

  // A job for the same ledger row that escapes the deterministic id — an
  // operator replay, a queue restored from a dump, or a duplicate produced by
  // another producer. The claim guard, not the job id, is what must stop it.
  const addDuplicateJob = async (job: EmailDeliveryJob): Promise<string> => {
    const jobId = `email-duplicate-${randomUUID()}`;
    await queue.add(EMAIL_JOB_NAME, job, { jobId });

    return jobId;
  };

  // The claim lands in the ledger before the transport is entered, so "one
  // call" is the moment the row is owned by a send that is now in flight.
  const waitForCalls = async (
    expected: number,
    timeoutMs = 10000
  ): Promise<void> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (fake.calls >= expected) {
        return;
      }
      await sleep(10);
    }

    throw new Error(
      `timed out waiting for ${expected} transport call(s); saw ${fake.calls}`
    );
  };

  // Every attempt has ended (delivered or aborted), so a second delivery can
  // no longer arrive unobserved.
  const waitForQuiescence = async (timeoutMs = 10000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (fake.inFlight === 0) {
        return;
      }
      await sleep(10);
    }

    throw new Error('timed out waiting for the transport to go quiet');
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

  it(
    'OC-R1: a stranded sending row past the threshold is reclaimed and delivered exactly once',
    async () => {
      const scenario = await createScenario();
      const event = createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      });
      const jobId = emailJobId(event.id, RECIPIENT);
      const job = deliveryJob(scenario, event.id);

      // The crash window's end state: the row was claimed, the process died
      // before the completion write, the stalled retry re-entered the processor,
      // the claim guard refused it, and the job finished having sent nothing.
      // Its record survives under the deterministic id (7-day retention).
      await stageStrandedRow({
        institutionId: scenario.institutionId,
        eventId: event.id,
        studentId: scenario.studentId,
        ageMs: HOUR_MS,
      });

      await queue.add(EMAIL_JOB_NAME, job, { jobId });
      expect(await waitForJobEnd(jobId)).toBe('completed');
      expect(fake.calls).toBe(0);
      expect((await queue.getJobCounts()).completed).toBe(1);

      // The hard part, stated by the queue itself: the record is retained, so a
      // naive re-add under the same id adds nothing.
      await queue.add(EMAIL_JOB_NAME, job, { jobId });
      expect((await queue.getJobCounts()).completed).toBe(1);

      // One sweep pass: an hour-old claim is reclaimed and requeued.
      expect(await runtime.claimSweeper.sweepOnce()).toBe(1);

      const rows = await waitForDeliveries(
        scenario.institutionId,
        {
          status: 'sent',
          count: 1,
        },
        4000
      );

      // Exactly one send for the row: the crash consumed one claim, the reclaim
      // one, and no transport call happened before the reclaim.
      expect(fake.calls).toBe(1);
      expect(rows[0].providerMessageId).not.toBeNull();
      expect(rows[0].attemptCount).toBe(2);

      // The reclaim had to travel under its own id because the deterministic one
      // is still taken — and the ledger, not the job id, kept it to one send.
      expect(await queue.getJob(jobId)).toBeDefined();
      expect(await queue.getJob(reclaimJobId(rows[0].id, 1))).toBeDefined();
      expect((await queue.getJobCounts()).completed).toBe(2);
    },
    15000
  );

  it(
    'P10: a reclaim of an accepted-but-unrecorded send carries the row key and delivers one message',
    async () => {
      const scenario = await createScenario();
      const event = createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      });

      // The first attempt runs the production send path, so the provider sees
      // the exact key the service derives for this row and accepts the message.
      await runtime.emailWorker.pause();
      await runtime.emailDelivery.enqueueForEvent(event);
      await waitForDeliveries(scenario.institutionId, {
        status: 'queued',
        count: 1,
      });
      await runtime.emailWorker.resume();

      const [delivered] = await waitForDeliveries(scenario.institutionId, {
        status: 'sent',
        count: 1,
      });
      const rowId = delivered.id;
      expect(fake.delivered).toBe(1);

      // The crash this case is about (P10): the provider accepted the message
      // and the ledger never learned it. The row goes back to exactly the state
      // that crash leaves — claimed once, an hour old — while the provider
      // keeps what it already accepted.
      await db.execute(sql`
        update email_deliveries
        set status = 'sending',
            attempt_count = 1,
            provider_message_id = null,
            provider_error = null,
            sent_at = null,
            updated_at = now() - make_interval(secs => ${HOUR_MS / 1000})
        where id = ${rowId}
      `);

      expect(await runtime.claimSweeper.sweepOnce()).toBe(1);

      const rows = await waitForDeliveries(
        scenario.institutionId,
        { status: 'sent', count: 1 },
        10000
      );

      // Two sends, one email: the retry had to go out — nothing in the ledger
      // or the queue could know the first was accepted — and the provider is
      // what absorbed it.
      expect(fake.calls).toBe(2);
      expect(fake.delivered).toBe(1);
      // Same key on both attempts of the row, so a provider can recognise the
      // retry; the message id the ledger ends with is the one accepted first.
      expect(fake.sent[1].idempotencyKey).toBe(fake.sent[0].idempotencyKey);
      expect(fake.sent[0].idempotencyKey).toBe(rowId);
      expect(rows[0].providerMessageId).toBe(delivered.providerMessageId);
      expect(rows[0].attemptCount).toBe(2);
      expect(await queue.getJob(reclaimJobId(rowId, 1))).toBeDefined();
    },
    20000
  );

  it('P10: the provider key is the row identity, so no two rows can share one', async () => {
    const scenario = await createScenario();
    await addGuardian(scenario.institutionId, scenario.studentId, 'dad@example.com');

    // Two events for one address and one event for a second address: the keys
    // have to separate the events and the addresses alike.
    const first = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    const second = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });

    await runtime.emailDelivery.enqueueForEvent(first);
    await runtime.emailDelivery.enqueueForEvent(second);

    const rows = await waitForDeliveries(
      scenario.institutionId,
      { status: 'sent', count: 4 },
      15000
    );

    const keys = fake.sent.map((message) => message.idempotencyKey);

    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
    // The key is the delivery row it belongs to, and nothing else: one distinct
    // key per (institution, event, address) row.
    expect(new Set(keys)).toEqual(new Set(rows.map((row) => row.id)));
  }, 20000);

  it('OC-R1: a fresh sending row is never reclaimed (an in-flight send is not double-sent)', async () => {
    const scenario = await createScenario();
    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });

    await stageStrandedRow({
      institutionId: scenario.institutionId,
      eventId: event.id,
      studentId: scenario.studentId,
      ageMs: 0,
    });

    expect(await runtime.claimSweeper.sweepOnce()).toBe(0);

    const [row] = await readDeliveries(scenario.institutionId);
    expect(row.status).toBe('sending');
    expect(row.attemptCount).toBe(1);

    // The row is still owned by the attempt that claimed it: another job for it
    // leaves without sending and without a second claim.
    const duplicateId = await addDuplicateJob(deliveryJob(scenario, event.id));
    expect(await waitForJobEnd(duplicateId)).toBe('completed');

    const [after] = await readDeliveries(scenario.institutionId);
    expect(after.attemptCount).toBe(1);
    expect(after.status).toBe('sending');
    expect(fake.calls).toBe(0);
  });

  it(
    'OC-R1: a send that outlives the claim threshold is aborted, never duplicated',
    async () => {
      const scenario = await createScenario();
      const event = createEnrollmentWelcomedEvent({
        institutionId: scenario.institutionId,
        payload: {
          enrollmentId: scenario.enrollmentId,
          studentId: scenario.studentId,
        },
      });

      // The slow provider response: this attempt is still in flight when the
      // reclaim threshold passes, which is the only window in which a reclaim
      // can race a live send.
      await runtime.emailWorker.pause();
      await runtime.emailDelivery.enqueueForEvent(event);
      const [queued] = await waitForDeliveries(scenario.institutionId, {
        status: 'queued',
        count: 1,
      });
      expect(queued.attemptCount).toBe(0);

      fake.hangOnceFor(HANG_MS);
      await runtime.emailWorker.resume();
      await waitForCalls(1);

      // Past the threshold, so the sweeper is entitled to treat the claim as
      // crashed — the deadline has to have ended the send before this point.
      await sleep(CLAIM_STALE_MS + SEND_TIMEOUT_MS + 300);
      const reclaimed = await runtime.claimSweeper.sweepOnce();

      const rows = await waitForDeliveries(
        scenario.institutionId,
        { status: 'sent', count: 1 },
        10000
      );

      // Let the slow attempt end too, so a second delivery cannot hide behind
      // its not having resolved yet.
      await waitForQuiescence();

      // Exactly one email reached the recipient: the hanging attempt was cut
      // off at the deadline, and the claim it guarded was never reclaimed
      // while it was still running.
      expect(fake.delivered).toBe(1);
      expect(fake.peakInFlight).toBe(1);
      expect(reclaimed).toBe(0);
      expect(rows[0].status).toBe('sent');
      expect(rows[0].providerMessageId).not.toBeNull();
    },
    20000
  );

  it('OC-R1: a stranded row whose job record is gone is reported as failed, not retried', async () => {
    const scenario = await createScenario();
    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });

    await stageStrandedRow({
      institutionId: scenario.institutionId,
      eventId: event.id,
      studentId: scenario.studentId,
      ageMs: HOUR_MS,
    });

    // Redis never kept — or has already evicted — the job record whose payload
    // the reclaim replays. Nothing can retry this delivery, ever.
    expect(await queue.getJob(emailJobId(event.id, RECIPIENT))).toBeUndefined();

    expect(await runtime.claimSweeper.sweepOnce()).toBe(0);

    const [row] = await readDeliveries(scenario.institutionId);
    // Claiming it is `retried` would advertise a retry that cannot happen.
    expect(row.status).toBe('failed');
    expect(row.providerError).toMatch(/job record/i);
    expect(fake.calls).toBe(0);
  });

  it('reclaims through the periodic pass, not only through an explicit sweep', async () => {
    const scenario = await createScenario();
    const event = createEnrollmentWelcomedEvent({
      institutionId: scenario.institutionId,
      payload: {
        enrollmentId: scenario.enrollmentId,
        studentId: scenario.studentId,
      },
    });
    const jobId = emailJobId(event.id, RECIPIENT);

    // The crash's end state, with the job record a live worker cannot use: the
    // claim guard refuses its replay, so the row leaves `sending` only if the
    // sweep reaches it.
    await stageStrandedRow({
      institutionId: scenario.institutionId,
      eventId: event.id,
      studentId: scenario.studentId,
      ageMs: HOUR_MS,
    });
    await queue.add(EMAIL_JOB_NAME, deliveryJob(scenario, event.id), { jobId });
    expect(await waitForJobEnd(jobId)).toBe('completed');
    expect(fake.calls).toBe(0);

    // The production entry point: start() → setInterval → runOnce → sweepOnce.
    const periodic = createEmailClaimSweeper({
      repository: new EmailDeliveriesRepository(db),
      queue,
      staleAfterMs: CLAIM_STALE_MS,
      intervalMs: 100,
    });

    try {
      periodic.start();

      const rows = await waitForDeliveries(
        scenario.institutionId,
        { status: 'sent', count: 1 },
        10000
      );

      expect(fake.calls).toBe(1);
      expect(rows[0].attemptCount).toBe(2);
    } finally {
      await periodic.close();
    }
  }, 20000);

  it('starts and stops the periodic claim sweep idempotently', async () => {
    runtime.claimSweeper.start();
    runtime.claimSweeper.start();
    await runtime.claimSweeper.close();
    await runtime.claimSweeper.close();

    // Stopping stops the timer only; an explicit pass stays available (the two
    // cases above drive it directly).
    expect(await runtime.claimSweeper.sweepOnce()).toBe(0);
  });
});
