import { RedisStreamsEventBus } from '@edunic/source/events';

export type WorkerConfig = {
  redisUrl: string;
  streamName: string;
};

export type WorkerRuntime = {
  config: WorkerConfig;
  eventBus: RedisStreamsEventBus;
};

// The worker exists to consume Redis Streams (P5-R1 / design D3), so a
// non-redis backend is a misconfiguration, not a fallback.
export function loadWorkerConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  if (env.EVENT_BUS_BACKEND !== 'redis') {
    throw new Error(
      'The worker requires EVENT_BUS_BACKEND=redis; it consumes Redis Streams via a consumer group'
    );
  }

  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is required when EVENT_BUS_BACKEND=redis');
  }

  return {
    redisUrl: env.REDIS_URL,
    streamName: env.EVENT_STREAM_NAME ?? 'edunic:domain-events',
  };
}

export function bootstrapWorker(
  env: NodeJS.ProcessEnv = process.env
): WorkerRuntime {
  const config = loadWorkerConfig(env);
  const eventBus = new RedisStreamsEventBus({
    redisUrl: config.redisUrl,
    streamName: config.streamName,
  });

  return { config, eventBus };
}
