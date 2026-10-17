import dotenv from 'dotenv';
import {
  createEnrollmentWelcomedEvent,
  type EnrollmentCreatedEvent,
} from '@edunic/source/domain/events';
import {
  RedisStreamConsumer,
  RedisStreamsEventBus,
} from '@edunic/source/events';

// Same env-loading convention as apps/edunic-api and libs/db.
dotenv.config();

export type WorkerConfig = {
  redisUrl: string;
  streamName: string;
};

export type WorkerRuntime = {
  config: WorkerConfig;
  eventBus: RedisStreamsEventBus;
  consumer: RedisStreamConsumer;
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

  // Side effect (D3, P5-R2): every processed enrollment.created publishes
  // enrollment.welcomed; the consumer's dedupe marker guarantees one welcome
  // per event id even when the broker delivers the event more than once.
  const consumer = new RedisStreamConsumer({
    redisUrl: config.redisUrl,
    streamName: config.streamName,
    handleEvent: async (event) => {
      if (event.name !== 'enrollment.created') {
        return;
      }

      const created = event as EnrollmentCreatedEvent;
      await eventBus.publish(
        createEnrollmentWelcomedEvent({
          institutionId: event.institutionId,
          payload: {
            enrollmentId: created.payload.enrollmentId,
            studentId: created.payload.studentId,
          },
        })
      );
    },
  });

  return { config, eventBus, consumer };
}
