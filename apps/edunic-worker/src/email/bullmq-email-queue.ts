import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import {
  emailJobId,
  type EmailDeliveryJob,
  type EmailJobQueue,
} from '@edunic/source/domain/notifications';

// Queue and worker factory (design D2/D3, task 4.5). It lives in the worker app
// rather than in the shared domain module on purpose: `libs/domain` is imported
// by the API, and a runtime BullMQ import there would drag the queue library
// into dist/apps/api/main.cjs for a queue the API never touches. The service
// depends on the EmailJobQueue port; this is the only BullMQ importer.
export const EMAIL_JOB_NAME = 'email-send';
export const EMAIL_JOB_ATTEMPTS = 5;
export const EMAIL_JOB_BACKOFF_MS = 1000;
export const EMAIL_JOB_KEEP_COMPLETED_MS = 7 * 24 * 60 * 60 * 1000;
export const EMAIL_JOB_KEEP_FAILED_MS = 30 * 24 * 60 * 60 * 1000;
export const EMAIL_WORKER_CONCURRENCY = 5;

export type EmailQueueOptions = {
  redisUrl: string;
  queueName: string;
  prefix: string;
};

// D3: a dedicated connection created here, never one of the repo's existing
// clients — those set `maxRetriesPerRequest: 1`, which aborts BullMQ's blocking
// commands.
export function buildEmailConnection(redisUrl: string) {
  return { url: redisUrl, maxRetriesPerRequest: null };
}

// D2: retries re-enter the same job id, so `attempts` can never multiply
// sends; the retention windows keep that id meaningful across the crash window
// (and keep failed jobs readable for the admin panel).
export function emailJobOptions(): JobsOptions {
  return {
    attempts: EMAIL_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: EMAIL_JOB_BACKOFF_MS },
    removeOnComplete: { age: EMAIL_JOB_KEEP_COMPLETED_MS },
    removeOnFail: { age: EMAIL_JOB_KEEP_FAILED_MS },
  };
}

export function createEmailQueue(options: EmailQueueOptions): Queue {
  return new Queue(options.queueName, {
    connection: buildEmailConnection(options.redisUrl),
    prefix: options.prefix,
    defaultJobOptions: emailJobOptions(),
  });
}

export function createEmailWorker(
  options: EmailQueueOptions & {
    process: (job: EmailDeliveryJob) => Promise<void>;
  }
): Worker<EmailDeliveryJob, void> {
  const processor: Processor<EmailDeliveryJob, void> = (job) =>
    options.process(job.data);

  return new Worker<EmailDeliveryJob, void>(options.queueName, processor, {
    connection: buildEmailConnection(options.redisUrl),
    prefix: options.prefix,
    concurrency: EMAIL_WORKER_CONCURRENCY,
  });
}

export type BullmqEmailQueue = EmailJobQueue & {
  /** Raw handle for inspection (queue-level assertions, obliterate). */
  readonly queue: Queue;
};

export function createBullmqEmailQueue(
  options: EmailQueueOptions
): BullmqEmailQueue {
  const queue = createEmailQueue(options);

  return {
    queue,
    async enqueue(job) {
      // The deterministic id is what makes a redelivered event, a crash between
      // the ledger write and this call, and a retry all converge on one job.
      await queue.add(EMAIL_JOB_NAME, job, {
        jobId: emailJobId(job.eventId, job.recipientAddress),
      });
    },
    async close() {
      await queue.close();
    },
  };
}
