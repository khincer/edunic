import dotenv from 'dotenv';
import { z } from 'zod';
import { EMAIL_SEND_TIMEOUT_DEFAULT_MS } from '@edunic/source/domain/notifications';

// Same env-loading convention as apps/edunic-api and libs/db.
dotenv.config();

/**
 * P9: the floor on the reclaim threshold, in milliseconds. Below this a
 * `sending` claim is treated as crashed so quickly that no send can be trusted
 * to have ended.
 */
export const MIN_CLAIM_STALE_MS = 1_000;

/**
 * P9: how far the reclaim threshold has to clear the send deadline. The
 * deadline aborts the provider call, but the completion write that follows it
 * is not instantaneous either, and the threshold is measured from the claim, so
 * the send path needs room to have finished and recorded its outcome before any
 * reclaim is allowed to consider the row stale.
 */
export const CLAIM_STALE_SAFETY_FACTOR = 2;

// The worker's environment contract (CF-R2, design D1/D5). This app had no
// schema before this change; the API schema stays untouched because the API
// neither sends nor queues, and a missing Resend key must not fail API startup.
export const workerEnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // 'redis' is the only valid backend: the worker consumes Redis Streams.
    EVENT_BUS_BACKEND: z.literal('redis', {
      message:
        'the worker consumes Redis Streams via a consumer group, so EVENT_BUS_BACKEND=redis is required',
    }),
    REDIS_URL: z
      .string()
      .min(1, 'REDIS_URL is required when EVENT_BUS_BACKEND=redis'),
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
      .number({
        message: 'EMAIL_CLAIM_STALE_MS must be a number of milliseconds',
      })
      .int()
      .positive('EMAIL_CLAIM_STALE_MS must be a positive number of milliseconds')
      .default(5 * 60 * 1000),
    // P9: how long one provider call may run before it is aborted. Optional
    // too, and its default is well under the 300 s socket default.
    EMAIL_SEND_TIMEOUT_MS: z.coerce
      .number({
        message: 'EMAIL_SEND_TIMEOUT_MS must be a number of milliseconds',
      })
      .int()
      .positive('EMAIL_SEND_TIMEOUT_MS must be a positive number of milliseconds')
      .default(EMAIL_SEND_TIMEOUT_DEFAULT_MS),
  })
  // P9: the pair is the guarantee. A reclaim may only treat a claim as crashed
  // once the send that claim admits is guaranteed to have ended, so a threshold
  // that does not clear the deadline is refused at startup instead of shipping
  // a duplicate send. This is what makes the smallest legal threshold
  // MIN_CLAIM_STALE_MS rather than 1 ms.
  .superRefine((env, ctx) => {
    const minimum = Math.max(
      MIN_CLAIM_STALE_MS,
      env.EMAIL_SEND_TIMEOUT_MS * CLAIM_STALE_SAFETY_FACTOR
    );

    if (env.EMAIL_CLAIM_STALE_MS < minimum) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_CLAIM_STALE_MS'],
        message: `EMAIL_CLAIM_STALE_MS must be at least ${minimum}: the reclaim threshold has to clear EMAIL_SEND_TIMEOUT_MS (${env.EMAIL_SEND_TIMEOUT_MS}) by ${CLAIM_STALE_SAFETY_FACTOR}x, with a floor of ${MIN_CLAIM_STALE_MS}, or a claim can be reclaimed while its send is still in flight`,
      });
    }
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
