import { envSchema, parseEnv } from '../../src/config/env.js';

// Every environment variable the API runtime reads, verified against the
// process.env call sites in apps/edunic-api and libs (P4-R2).
const DOCUMENTED_VARIABLES = [
  'CORS_ALLOW_CREDENTIALS',
  'CORS_ORIGINS',
  'DATABASE_URL',
  'EVENT_BUS_BACKEND',
  'EVENT_STREAM_NAME',
  'IDEMPOTENCY_REDIS_URL',
  'JWT_SECRET',
  'LOG_LEVEL',
  'NODE_ENV',
  'PORT',
  'REDIS_URL',
];

describe('env schema', () => {
  it('documents every environment variable the API reads', () => {
    expect(Object.keys(envSchema.shape).sort()).toEqual(DOCUMENTED_VARIABLES);
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(() => parseEnv({})).toThrow(/JWT_SECRET/);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ JWT_SECRET: 'secret', PORT: 'not-a-number' })).toThrow();
  });

  it('rejects an unknown CORS_ALLOW_CREDENTIALS flag', () => {
    expect(() =>
      parseEnv({ JWT_SECRET: 'secret', CORS_ALLOW_CREDENTIALS: 'maybe' })
    ).toThrow();
  });

  it('defaults PORT to 3000 when only JWT_SECRET is provided', () => {
    const env = parseEnv({ JWT_SECRET: 'secret' });

    expect(env.PORT).toBe(3000);
    expect(env.JWT_SECRET).toBe('secret');
  });

  it('coerces and keeps every documented variable from a full source', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      PORT: '4000',
      JWT_SECRET: 'secret',
      LOG_LEVEL: 'warn',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/edu_platform',
      REDIS_URL: 'redis://localhost:6379',
      IDEMPOTENCY_REDIS_URL: 'redis://localhost:6380',
      EVENT_BUS_BACKEND: 'redis',
      EVENT_STREAM_NAME: 'edunic:domain-events',
      CORS_ORIGINS: 'http://localhost:3001,http://127.0.0.1:3001',
      CORS_ALLOW_CREDENTIALS: 'true',
    });

    expect(env).toEqual({
      NODE_ENV: 'production',
      PORT: 4000,
      JWT_SECRET: 'secret',
      LOG_LEVEL: 'warn',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/edu_platform',
      REDIS_URL: 'redis://localhost:6379',
      IDEMPOTENCY_REDIS_URL: 'redis://localhost:6380',
      EVENT_BUS_BACKEND: 'redis',
      EVENT_STREAM_NAME: 'edunic:domain-events',
      CORS_ORIGINS: 'http://localhost:3001,http://127.0.0.1:3001',
      CORS_ALLOW_CREDENTIALS: 'true',
    });
    expect(typeof env.PORT).toBe('number');
  });
});
