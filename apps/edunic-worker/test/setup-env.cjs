// Worker tests run against the real Redis Streams wiring (P5-R1): the API
// app under test must publish through RedisStreamsEventBus, and the worker
// bootstrap must join the consumer group — same production configuration as
// the compose worker service (EVENT_BUS_BACKEND=redis).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.EVENT_BUS_BACKEND = process.env.EVENT_BUS_BACKEND || 'redis';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// The worker's own env schema (config/env.ts) validates these at startup
// (CF-R2). The Resend key is a dummy on purpose: no test ever reaches the
// provider (the suite injects FakeEmailTransport), and a real key must never
// live in the repository.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/edu_platform';
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test-resend-key';
process.env.EMAIL_FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS || 'no-reply@edunic.test';
process.env.EMAIL_REPLY_TO =
  process.env.EMAIL_REPLY_TO || 'support@edunic.test';
