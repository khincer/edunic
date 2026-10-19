import dotenv from 'dotenv';
import { Resend } from 'resend';
import type { Worker } from 'bullmq';
import {
  createEnrollmentWelcomedEvent,
  type EnrollmentCreatedEvent,
} from '@edunic/source/domain/events';
import {
  EmailDeliveriesRepository,
  EmailDeliveryService,
  ResendEmailTransport,
  type EmailTransport,
  type EmailTriggerEvent,
} from '@edunic/source/domain/notifications';
import { FeatureFlagsRepository } from '@edunic/source/domain/feature-flags';
import { createDb } from '@edunic/source/db';
import {
  RedisStreamConsumer,
  RedisStreamsEventBus,
} from '@edunic/source/events';
import { parseWorkerEnv } from './config/env.js';
import {
  createBullmqEmailQueue,
  createEmailWorker,
  type BullmqEmailQueue,
} from './email/bullmq-email-queue.js';
import {
  createEmailClaimSweeper,
  type EmailClaimSweeper,
} from './email/email-claim-sweeper.js';

// Same env-loading convention as apps/edunic-api and libs/db.
dotenv.config();

export type WorkerConfig = {
  redisUrl: string;
  streamName: string;
  databaseUrl: string;
  resendApiKey: string;
  emailQueueName: string;
  emailQueuePrefix: string;
  emailFromAddress: string;
  emailReplyTo: string;
  emailClaimStaleMs: number;
  /** P9: the send deadline, validated to sit well inside the threshold. */
  emailSendTimeoutMs: number;
};

export type WorkerDeps = {
  /** Test seam (design D5): the provider is the only substituted boundary. */
  emailTransport?: EmailTransport;
};

export type WorkerRuntime = {
  config: WorkerConfig;
  eventBus: RedisStreamsEventBus;
  consumer: RedisStreamConsumer;
  db: ReturnType<typeof createDb>['db'];
  pool: ReturnType<typeof createDb>['pool'];
  emailQueue: BullmqEmailQueue;
  emailWorker: Worker;
  emailTransport: EmailTransport;
  emailDelivery: EmailDeliveryService;
  /** OC-R1 (P8): the stale-claim reclaim path, not started by this factory. */
  claimSweeper: EmailClaimSweeper;
};

const EMAIL_TRIGGER_NAMES = [
  'enrollment.welcomed',
  'grade.submitted',
  'attendance.marked',
] as const;

function isEmailTrigger(eventName: string): boolean {
  return (EMAIL_TRIGGER_NAMES as readonly string[]).includes(eventName);
}

// D1: the worker gains database access and its own composition root — the API
// neither enqueues nor sends. The env schema is the startup validation
// boundary (CF-R2), so a misconfigured deploy fails naming the key.
export function loadWorkerConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  const parsed = parseWorkerEnv(env);

  return {
    redisUrl: parsed.REDIS_URL,
    streamName: parsed.EVENT_STREAM_NAME ?? 'edunic:domain-events',
    databaseUrl: parsed.DATABASE_URL,
    resendApiKey: parsed.RESEND_API_KEY,
    emailQueueName: parsed.EMAIL_QUEUE_NAME,
    emailQueuePrefix: parsed.EMAIL_QUEUE_PREFIX,
    emailFromAddress: parsed.EMAIL_FROM_ADDRESS,
    emailReplyTo: parsed.EMAIL_REPLY_TO,
    emailClaimStaleMs: parsed.EMAIL_CLAIM_STALE_MS,
    emailSendTimeoutMs: parsed.EMAIL_SEND_TIMEOUT_MS,
  };
}

export function bootstrapWorker(
  env: NodeJS.ProcessEnv = process.env,
  deps: WorkerDeps = {}
): WorkerRuntime {
  const config = loadWorkerConfig(env);
  const eventBus = new RedisStreamsEventBus({
    redisUrl: config.redisUrl,
    streamName: config.streamName,
  });

  const { db, pool } = createDb({ databaseUrl: config.databaseUrl });
  const emailQueueOptions = {
    redisUrl: config.redisUrl,
    queueName: config.emailQueueName,
    prefix: config.emailQueuePrefix,
  };

  const emailQueue = createBullmqEmailQueue(emailQueueOptions);
  // D5: the SDK is constructed here, at the composition root, never at module
  // import — no test and no API process ever needs a Resend key.
  const emailTransport =
    deps.emailTransport ??
    new ResendEmailTransport({ client: new Resend(config.resendApiKey) });

  const emailDeliveries = new EmailDeliveriesRepository(db);

  const emailDelivery = new EmailDeliveryService({
    repository: emailDeliveries,
    featureFlags: new FeatureFlagsRepository(db),
    queue: emailQueue,
    transport: emailTransport,
    fromAddress: config.emailFromAddress,
    defaultReplyTo: config.emailReplyTo,
    sendTimeoutMs: config.emailSendTimeoutMs,
  });

  // D6 (P8): the reclaim path shares the worker's own ledger repository and its
  // queue. It is built here but started by main.ts, so a test runtime is a
  // runtime without a background timer.
  const claimSweeper = createEmailClaimSweeper({
    repository: emailDeliveries,
    queue: emailQueue.queue,
    staleAfterMs: config.emailClaimStaleMs,
  });

  const emailWorker = createEmailWorker({
    ...emailQueueOptions,
    process: (job) => emailDelivery.handleDeliveryJob(job),
  });

  // Side effect (D3, P5-R2): every processed enrollment.created publishes
  // enrollment.welcomed; the consumer's dedupe marker guarantees one welcome
  // per event id even when the broker delivers the event more than once.
  const consumer = new RedisStreamConsumer({
    redisUrl: config.redisUrl,
    streamName: config.streamName,
    handleEvent: async (event) => {
      if (event.name === 'enrollment.created') {
        const created = event as EnrollmentCreatedEvent;
        await eventBus.publish(
          createEnrollmentWelcomedEvent({
            institutionId: event.institutionId,
            payload: {
              enrollmentId: created.payload.enrollmentId,
              studentId: created.payload.studentId,
            },
          })
        );
        return;
      }

      // EV-R1: the three triggers enqueue one delivery per distinct recipient
      // address. A failure here throws on purpose: the entry stays unacked and
      // is redelivered (RS-R1 protects the origin write, not this retry).
      if (isEmailTrigger(event.name)) {
        await emailDelivery.enqueueForEvent(event as EmailTriggerEvent);
      }
    },
  });

  return {
    config,
    eventBus,
    consumer,
    db,
    pool,
    emailQueue,
    emailWorker,
    emailTransport,
    emailDelivery,
    claimSweeper,
  };
}
