import { RedisStreamsEventBus } from '@edunic/source/events';
import { bootstrapWorker } from '../src/bootstrap.js';

// Task 7.1 (P5-R1, design D3): the worker entry wiring loads env and builds a
// RedisStreamsEventBus pointed at the domain-events stream. The bus never
// connects in the constructor, so these assertions are pure configuration
// checks — no Redis instance required.
describe('worker bootstrap', () => {
  it('creates a RedisStreamsEventBus on the default domain-events stream', () => {
    const { config, eventBus } = bootstrapWorker({
      EVENT_BUS_BACKEND: 'redis',
      REDIS_URL: 'redis://localhost:6399',
    });

    expect(config.streamName).toBe('edunic:domain-events');
    expect(eventBus).toBeInstanceOf(RedisStreamsEventBus);
  });

  it('honors an EVENT_STREAM_NAME override', () => {
    const { config, eventBus } = bootstrapWorker({
      EVENT_BUS_BACKEND: 'redis',
      REDIS_URL: 'redis://localhost:6399',
      EVENT_STREAM_NAME: 'edunic:custom-stream',
    });

    expect(config.streamName).toBe('edunic:custom-stream');
    expect(eventBus).toBeInstanceOf(RedisStreamsEventBus);
  });

  it('rejects a non-redis backend because the worker consumes Redis Streams', () => {
    expect(() =>
      bootstrapWorker({ EVENT_BUS_BACKEND: 'memory', REDIS_URL: 'redis://x' })
    ).toThrow(/EVENT_BUS_BACKEND=redis/);
  });

  it('rejects a missing REDIS_URL when the redis backend is selected', () => {
    expect(() => bootstrapWorker({ EVENT_BUS_BACKEND: 'redis' })).toThrow(
      /REDIS_URL/
    );
  });
});
