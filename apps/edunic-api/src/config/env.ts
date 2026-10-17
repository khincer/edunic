import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Documented API environment variables (P4-R2). This list mirrors every
// process.env call site in apps/edunic-api and libs at the time of writing:
// PORT/JWT_SECRET/CORS_* via config/env.ts, LOG_LEVEL/NODE_ENV in app.ts,
// DATABASE_URL in libs/db, REDIS_URL/IDEMPOTENCY_REDIS_URL in the idempotency
// plugin, and EVENT_BUS_BACKEND/EVENT_STREAM_NAME in libs/events. Modules that
// read process.env directly still validate at their own boundary; routing
// them all through this schema is follow-up work.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET must not be empty'),
  LOG_LEVEL: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  IDEMPOTENCY_REDIS_URL: z.string().min(1).optional(),
  // 'redis' selects the Redis Streams backend; anything else = in-memory.
  EVENT_BUS_BACKEND: z.string().optional(),
  EVENT_STREAM_NAME: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().optional(),
  CORS_ALLOW_CREDENTIALS: z.enum(['true', 'false']).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

function parseCsv(value: string | undefined) {
  return value
    ?.trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => item.trim())
    .map((item) => item.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

const parsed = parseEnv(process.env);

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  JWT_SECRET: parsed.JWT_SECRET,
  LOG_LEVEL: parsed.LOG_LEVEL,
  DATABASE_URL: parsed.DATABASE_URL,
  REDIS_URL: parsed.REDIS_URL,
  IDEMPOTENCY_REDIS_URL: parsed.IDEMPOTENCY_REDIS_URL,
  EVENT_BUS_BACKEND: parsed.EVENT_BUS_BACKEND,
  EVENT_STREAM_NAME: parsed.EVENT_STREAM_NAME,
  CORS_ORIGINS:
    parseCsv(parsed.CORS_ORIGINS) ?? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
      'http://127.0.0.1:3004',
      'http://*.edunic.test:3001',
      'http://*.localhost:3001',
      'http://*.localtest.me:3001',
      'http://*.lvh.me:3001',
      'http://app.central-school.test:3001',
      'http://app.north-school.test:3001',
    ],
  CORS_ALLOW_CREDENTIALS: parsed.CORS_ALLOW_CREDENTIALS === 'true',
};
