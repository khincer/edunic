import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';

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
    const redisUrl = new URL(this.redisUrl);
    const port = Number(redisUrl.port || 6379);
    const host = redisUrl.hostname;
    const password = decodeURIComponent(redisUrl.password || '');
    const commandParts = [
      'XADD',
      this.streamName,
      '*',
      'event',
      JSON.stringify(event),
    ];

    await sendRedisCommands({
      host,
      port,
      commands: [
        ...(password ? [['AUTH', password]] : []),
        commandParts,
      ],
    });
  }
}

export function createEventBusFromEnv(): EventBus {
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

async function sendRedisCommands(input: {
  host: string;
  port: number;
  commands: string[][];
}) {
  await new Promise<void>((resolve, reject) => {
    let commandIndex = 0;
    const firstCommand = input.commands[commandIndex];

    if (!firstCommand) {
      resolve();
      return;
    }

    const socket = createConnection(
      {
        host: input.host,
        port: input.port,
      },
      () => {
        socket.write(encodeRespCommand(firstCommand));
      }
    );

    socket.on('data', (chunk) => {
      const response = chunk.toString('utf8');

      if (response.startsWith('-')) {
        socket.end();
        reject(new Error(response.slice(1).trim()));
        return;
      }

      commandIndex += 1;

      if (commandIndex >= input.commands.length) {
        socket.end();
        resolve();
        return;
      }

      const nextCommand = input.commands[commandIndex];

      if (!nextCommand) {
        socket.end();
        resolve();
        return;
      }

      socket.write(encodeRespCommand(nextCommand));
    });

    socket.once('error', reject);
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('Redis command timed out'));
    });
  });
}

function encodeRespCommand(parts: string[]) {
  return [
    `*${parts.length}`,
    ...parts.flatMap((part) => [`$${Buffer.byteLength(part)}`, part]),
    '',
  ].join('\r\n');
}
