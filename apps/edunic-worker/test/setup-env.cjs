// Worker tests run against the real Redis Streams wiring (P5-R1): the API
// app under test must publish through RedisStreamsEventBus, and the worker
// bootstrap must join the consumer group — same production configuration as
// the compose worker service (EVENT_BUS_BACKEND=redis).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.EVENT_BUS_BACKEND = process.env.EVENT_BUS_BACKEND || 'redis';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
