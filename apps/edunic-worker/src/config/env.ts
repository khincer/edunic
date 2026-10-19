import dotenv from 'dotenv';
import { z } from 'zod';

// Same env-loading convention as apps/edunic-api and libs/db.
dotenv.config();

// The worker's environment contract (CF-R2, design D1/D5). This app had no
// schema before this change; the API schema stays untouched because the API
// neither sends nor queues, and a missing Resend key must not fail API startup.
export const workerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // 'redis' is the only valid backend: the worker consumes Redis Streams.
  EVENT_BUS_BACKEND: z.literal('redis', {
    message:
      'the worker consumes Redis Streams via a consumer group, so EVENT_BUS_BACKEND=redis is required',
  }),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required when EVENT_BUS_BACKEND=redis'),
  EVENT_STREAM_NAME: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM_ADDRESS: z
    .string()
    .trim()
    .email('EMAIL_FROM_ADDRESS must be a valid email address'),
  EMAIL_REPLY_TO: z
    .string()
    .trim()
    .email('EMAIL_REPLY_TO must be a valid email address'),
  EMAIL_QUEUE_NAME: z.string().min(1).default('email-delivery'),
  EMAIL_QUEUE_PREFIX: z.string().min(1).default('edunic:email'),
  // OC-R1 (P8): how long a `sending` claim may sit before the sweep treats it
  // as a crashed attempt and reclaims it. Optional — the worker's required keys
  // do not grow.
  EMAIL_CLAIM_STALE_MS: z.coerce
    .number({ message: 'EMAIL_CLAIM_STALE_MS must be a number of milliseconds' })
    .int()
    .positive('EMAIL_CLAIM_STALE_MS must be a positive number of milliseconds')
    .default(5 * 60 * 1000),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

// Startup validation fails by naming every offending key, so a misconfigured
// deploy says which variable is wrong instead of "invalid environment".
export function parseWorkerEnv(source: NodeJS.ProcessEnv): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid worker environment:\n${issues}`);
  }

  return result.data;
}
