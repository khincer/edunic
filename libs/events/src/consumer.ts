import Redis, { type Redis as RedisClient } from 'ioredis';
import type { EventEnvelope } from './index.js';

// Design D3 (P5-R1, P5-R3): Redis Streams consumer group over the domain
// events stream. The group starts at the stream tip ('$') so pre-existing
// history is never replayed, every event is deduplicated per event id, and a
// delivery is acked only after its side effect completed (at-least-once).
export type StreamConsumerOptions = {
  redisUrl: string;
  streamName?: string;
  consumerGroup?: string;
  consumerName?: string;
  handleEvent: (event: EventEnvelope) => Promise<void> | void;
};

export type PollOptions = {
  /** Block up to this many ms waiting for new entries; 0/undefined returns immediately. */
  blockMs?: number;
  count?: number;
};

type StreamEntry = { id: string; event: EventEnvelope };
type XReadGroupReply = Array<[string, Array<[string, Array<string>]>]> | null;

const DEFAULT_STREAM_NAME = 'edunic:domain-events';
const DEFAULT_CONSUMER_GROUP = 'edunic-worker';

function isBusyGroupError(error: unknown): boolean {
  return error instanceof Error && /BUSYGROUP/.test(error.message);
}

export class RedisStreamConsumer {
  private readonly client: RedisClient;
  private readonly streamName: string;
  private readonly consumerGroup: string;
  private readonly consumerName: string;
  private readonly handleEvent: NonNullable<
    StreamConsumerOptions['handleEvent']
  >;

  constructor(options: StreamConsumerOptions) {
    // Lazy: constructing the worker runtime must not open sockets (bootstrap
    // specs build a full runtime against a dummy URL without connecting).
    this.client = new Redis(options.redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.streamName = options.streamName ?? DEFAULT_STREAM_NAME;
    this.consumerGroup = options.consumerGroup ?? DEFAULT_CONSUMER_GROUP;
    this.consumerName = options.consumerName ?? `worker-${process.pid}`;
    this.handleEvent = options.handleEvent;
  }

  async ensureGroup(): Promise<void> {
    try {
      await this.client.xgroup(
        'CREATE',
        this.streamName,
        this.consumerGroup,
        '$',
        'MKSTREAM'
      );
    } catch (error) {
      // The group persists across restarts: already exists is success.
      if (!isBusyGroupError(error)) {
        throw error;
      }
    }
  }

  async pollOnce(options: PollOptions = {}): Promise<number> {
    const count = options.count ?? 10;

    // Own pending entries first: entries whose ack never happened are
    // redelivered to this consumer, and processing them before new ones
    // keeps per-entry order after a crash or handler failure.
    const pending = await this.readEntries('0', count);
    let processed = await this.dispatch(pending);

    const fresh = await this.readEntries('>', count, options.blockMs);
    processed += await this.dispatch(fresh);

    return processed;
  }

  close(): void {
    this.client.disconnect();
  }

  private dedupeKey(event: EventEnvelope): string {
    return `processed:${event.id}`;
  }

  private async ack(entryId: string): Promise<void> {
    await this.client.xack(
      this.streamName,
      this.consumerGroup,
      entryId
    );
  }

  private async readEntries(
    fromId: string,
    count: number,
    blockMs?: number
  ): Promise<StreamEntry[]> {
    const args: string[] = [
      'GROUP',
      this.consumerGroup,
      this.consumerName,
      'COUNT',
      String(count),
    ];

    // BLOCK 0 would mean "forever" in Redis, so only an explicit positive
    // window blocks; otherwise the read returns immediately.
    if (fromId === '>' && blockMs && blockMs > 0) {
      args.push('BLOCK', String(blockMs));
    }

    args.push('STREAMS', this.streamName, fromId);

    const reply = (await this.client.call(
      'XREADGROUP',
      ...args
    )) as XReadGroupReply | [string, Array<[string, Array<string>]>] | null;

    if (!reply) {
      return [];
    }

    // ioredis unwraps single-stream replies to [stream, messages]; a raw
    // Redis reply would be the nested [[stream, messages]]. Handle both.
    const streams = (
      typeof reply[0] === 'string' ? [reply] : reply
    ) as Array<[string, Array<[string, Array<string>]>]>;

    const entries: StreamEntry[] = [];
    for (const [, messageIds] of streams) {
      for (const [entryId, fields] of messageIds) {
        const eventIndex = fields.findIndex((field) => field === 'event');
        if (eventIndex === -1) {
          // Poison entry: not acked, so it stays visible in the pending list.
          throw new Error(
            `stream entry ${entryId} has no "event" field; refusing to ack`
          );
        }
        entries.push({
          id: entryId,
          event: JSON.parse(fields[eventIndex + 1]) as EventEnvelope,
        });
      }
    }

    return entries;
  }

  private async dispatch(entries: StreamEntry[]): Promise<number> {
    let processed = 0;

    for (const { id, event } of entries) {
      // Check the marker before running the side effect, but write it only
      // after the handler succeeded: a marker-first order would leave a
      // marked-but-unprocessed event after a crash, silently losing the
      // side effect (at-least-once forbids loss; duplicates are deduped).
      const alreadyProcessed =
        (await this.client.exists(this.dedupeKey(event))) === 1;

      if (alreadyProcessed) {
        // Duplicate delivery of a completed event: ack so it does not loop.
        await this.ack(id);
        continue;
      }

      await this.handleEvent(event);
      await this.client.set(this.dedupeKey(event), '1', 'NX');
      await this.ack(id);
      processed += 1;
    }

    return processed;
  }
}
