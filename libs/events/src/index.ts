import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

export type EventEnvelope<TName extends string = string, TPayload = unknown> = {
  id: string;
  name: TName;
  institutionId: string;
  payload: TPayload;
  occurredAt: string;
};

export type EventHandler<TEvent extends EventEnvelope = EventEnvelope> = (
  event: TEvent
) => Promise<void> | void;

export interface EventBus {
  publish<TEvent extends EventEnvelope>(event: TEvent): Promise<void>;
  subscribe<TEvent extends EventEnvelope>(
    eventName: TEvent['name'],
    handler: EventHandler<TEvent>
  ): () => void;
}

export function createEventEnvelope<TName extends string, TPayload>(input: {
  name: TName;
  institutionId: string;
  payload: TPayload;
}): EventEnvelope<TName, TPayload> {
  return {
    id: randomUUID(),
    name: input.name,
    institutionId: input.institutionId,
    payload: input.payload,
    occurredAt: new Date().toISOString(),
  };
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  async publish<TEvent extends EventEnvelope>(event: TEvent) {
    const handlers = this.handlers.get(event.name) ?? new Set();

    for (const handler of handlers) {
      await handler(event);
    }
  }

  subscribe<TEvent extends EventEnvelope>(
    eventName: TEvent['name'],
    handler: EventHandler<TEvent>
  ) {
    const handlers = this.handlers.get(eventName) ?? new Set<EventHandler>();
    handlers.add(handler as EventHandler);
    this.handlers.set(eventName, handlers);

    return () => {
      handlers.delete(handler as EventHandler);
    };
  }
}

export class RedisStreamsEventBus implements EventBus {
  private readonly memoryBus = new InMemoryEventBus();
  private readonly streamName: string;
  private readonly redisUrl: string;

  constructor(input: { redisUrl: string; streamName?: string }) {
    this.redisUrl = input.redisUrl;
    this.streamName = input.streamName ?? 'edunic:domain-events';
  }

  async publish<TEvent extends EventEnvelope>(event: TEvent) {
    await this.xadd(event);
    await this.memoryBus.publish(event);
  }

  subscribe<TEvent extends EventEnvelope>(
    eventName: TEvent['name'],
    handler: EventHandler<TEvent>
  ) {
    return this.memoryBus.subscribe(eventName, handler);
  }

  private async xadd(event: EventEnvelope) {
    const client = new Redis(this.redisUrl, { maxRetriesPerRequest: 1 });

    try {
      await client.xadd(this.streamName, '*', 'event', JSON.stringify(event));
    } finally {
      client.disconnect();
    }
  }
}

export function createEventBusFromEnv() {
  if (process.env.EVENT_BUS_BACKEND === 'redis') {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is required when EVENT_BUS_BACKEND=redis');
    }

    return new RedisStreamsEventBus({
      redisUrl: process.env.REDIS_URL,
      streamName: process.env.EVENT_STREAM_NAME,
    });
  }

  return new InMemoryEventBus();
}
