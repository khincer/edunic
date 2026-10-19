import { RedisStreamsEventBus } from '@edunic/source/events';
import {
  bootstrapWorker,
  loadWorkerConfig,
  type WorkerRuntime,
} from '../src/bootstrap.js';
import { FakeEmailTransport } from './helpers/fake-email-transport.js';

// Task 4.2 / 4.3 (CF-R2, CF-R1): the worker's env schema (its first) is the
// startup validation boundary — every required key must fail by naming itself,
// and the queue name/prefix must fall back to the documented defaults. Config
// assertions go through loadWorkerConfig (pure parse, no socket); the single
// composition case bootstraps the full runtime against real Redis.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function requiredEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    EVENT_BUS_BACKEND: 'redis',
    REDIS_URL,
    DATABASE_URL:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/edu_platform',
    RESEND_API_KEY: 'test-resend-key',
    EMAIL_FROM_ADDRESS: 'no-reply@edunic.test',
    EMAIL_REPLY_TO: 'support@edunic.test',
    ...overrides,
  };
}

function requiredEnvWithout(key: string): NodeJS.ProcessEnv {
  const env = requiredEnv();
  delete env[key];
  return env;
}

describe('worker bootstrap', () => {
  const runtimes: WorkerRuntime[] = [];

  afterAll(async () => {
    for (const runtime of runtimes) {
      await runtime.emailWorker.close();
      await runtime.emailQueue.close();
      await runtime.pool.end();
    }
  });

  it('defaults the stream, the queue name and the queue prefix', () => {
    const config = loadWorkerConfig(requiredEnv());

    expect(config.streamName).toBe('edunic:domain-events');
    expect(config.emailQueueName).toBe('email-delivery');
    expect(config.emailQueuePrefix).toBe('edunic:email');
  });

  it('honors an EVENT_STREAM_NAME override', () => {
    const config = loadWorkerConfig(
      requiredEnv({ EVENT_STREAM_NAME: 'edunic:custom-stream' })
    );

    expect(config.streamName).toBe('edunic:custom-stream');
  });

  it('honors EMAIL_QUEUE_NAME and EMAIL_QUEUE_PREFIX overrides', () => {
    const config = loadWorkerConfig(
      requiredEnv({
        EMAIL_QUEUE_NAME: 'email-delivery-custom',
        EMAIL_QUEUE_PREFIX: 'edunic:email-custom',
      })
    );

    expect(config.emailQueueName).toBe('email-delivery-custom');
    expect(config.emailQueuePrefix).toBe('edunic:email-custom');
  });

  it('defaults the stale-claim threshold and honors its optional override', () => {
    // OC-R1 (P8): optional, so the worker's required keys do not grow.
    expect(loadWorkerConfig(requiredEnv()).emailClaimStaleMs).toBe(300000);
    expect(
      loadWorkerConfig(requiredEnv({ EMAIL_CLAIM_STALE_MS: '1500' }))
        .emailClaimStaleMs
    ).toBe(1500);
  });

  it('rejects a non-numeric EMAIL_CLAIM_STALE_MS naming the key', () => {
    expect(() =>
      loadWorkerConfig(requiredEnv({ EMAIL_CLAIM_STALE_MS: 'soon' }))
    ).toThrow(/EMAIL_CLAIM_STALE_MS/);
  });

  it('rejects a non-redis backend because the worker consumes Redis Streams', () => {
    expect(() =>
      loadWorkerConfig(requiredEnv({ EVENT_BUS_BACKEND: 'memory' }))
    ).toThrow(/EVENT_BUS_BACKEND=redis/);
  });

  it('rejects a missing REDIS_URL when the redis backend is selected', () => {
    expect(() => loadWorkerConfig(requiredEnvWithout('REDIS_URL'))).toThrow(
      /REDIS_URL/
    );
  });

  it('rejects a missing DATABASE_URL naming the key (CF-R2)', () => {
    expect(() => loadWorkerConfig(requiredEnvWithout('DATABASE_URL'))).toThrow(
      /DATABASE_URL/
    );
  });

  it('rejects a missing RESEND_API_KEY naming the key (CF-R2)', () => {
    expect(() => loadWorkerConfig(requiredEnvWithout('RESEND_API_KEY'))).toThrow(
      /RESEND_API_KEY/
    );
  });

  it('rejects a missing EMAIL_FROM_ADDRESS naming the key (CF-R2)', () => {
    expect(() =>
      loadWorkerConfig(requiredEnvWithout('EMAIL_FROM_ADDRESS'))
    ).toThrow(/EMAIL_FROM_ADDRESS/);
  });

  it('rejects an invalid EMAIL_FROM_ADDRESS naming the key (CF-R2)', () => {
    expect(() =>
      loadWorkerConfig(requiredEnv({ EMAIL_FROM_ADDRESS: 'not-an-address' }))
    ).toThrow(/EMAIL_FROM_ADDRESS/);
  });

  it('rejects an invalid EMAIL_REPLY_TO naming the key (CF-R2)', () => {
    expect(() =>
      loadWorkerConfig(requiredEnv({ EMAIL_REPLY_TO: 'not-an-address' }))
    ).toThrow(/EMAIL_REPLY_TO/);
  });

  it('composes the event bus, the database, the queue and the transport into one runtime', async () => {
    const emailTransport = new FakeEmailTransport();
    const runtime = bootstrapWorker(
      requiredEnv({
        EMAIL_QUEUE_NAME: `email-delivery-bootstrap-test-${process.pid}`,
        EMAIL_QUEUE_PREFIX: 'edunic:email-bootstrap-test',
      }),
      { emailTransport }
    );
    runtimes.push(runtime);

    expect(runtime.eventBus).toBeInstanceOf(RedisStreamsEventBus);
    expect(runtime.config.streamName).toBe('edunic:domain-events');
    expect(runtime.db).toBeDefined();
    expect(runtime.pool).toBeDefined();
    expect(runtime.emailDelivery).toBeDefined();
    expect(runtime.claimSweeper).toBeDefined();
    expect(runtime.emailTransport).toBe(emailTransport);
    expect(runtime.emailQueue.queue.name).toBe(
      `email-delivery-bootstrap-test-${process.pid}`
    );
    expect(runtime.emailWorker.name).toBe(
      `email-delivery-bootstrap-test-${process.pid}`
    );
  });
});
