import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import {
  RedisStreamConsumer,
  type EventEnvelope,
} from '@edunic/source/events';

// Task 7.2 (P5-R1, P5-R3, design D3): the stream consumer joins group
// edunic-worker, reads with XREADGROUP, dedupes per event id and acks only
// after the side effect succeeded. Every case runs against a real Redis
// stream (unique per test) so the XGROUP/XREADGROUP/XACK/SET NX commands
// themselves are under test.
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// ioredis 6 ships no xinfoGroups helper; XINFO GROUPS returns one flat
// key/value array per group.
async function groupNames(client: Redis, stream: string): Promise<string[]> {
  const reply = (await client
    .call('XINFO', 'GROUPS', stream)
    .catch(() => null)) as Array<unknown[]> | null;

  if (!reply) {
    return [];
  }

  return reply.map((flat) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < flat.length; i += 2) {
      record[String(flat[i])] = flat[i + 1];
    }
    return String(record.name);
  });
}

function makeEvent(id = randomUUID()): EventEnvelope {
  return {
    id,
    name: 'enrollment.created',
    institutionId: 'inst-consumer-1',
    payload: { enrollmentId: 'enr-1', studentId: 'stu-1' },
    occurredAt: new Date().toISOString(),
  };
}

describe('RedisStreamConsumer', () => {
  let client: Redis;
  let stream: string;
  let consumer: RedisStreamConsumer;
  let handled: EventEnvelope[];

  const xadd = (event: EventEnvelope) =>
    client.xadd(stream, '*', 'event', JSON.stringify(event));

  const pendingEntryIds = async () => {
    const pending = (await client.xpending(
      stream,
      'edunic-worker',
      '-',
      '+',
      10
    )) as Array<[string, string, string, number]> | null;
    return pending?.map((entry) => entry[0]) ?? [];
  };

  beforeEach(() => {
    stream = `edunic:domain-events:test:${randomUUID()}`;
    client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
    handled = [];
    consumer = new RedisStreamConsumer({
      redisUrl: REDIS_URL,
      streamName: stream,
      handleEvent: (event) => {
        handled.push(event);
      },
    });
  });

  afterEach(async () => {
    await consumer.close();
    client.disconnect();
  });

  it('delivers a stream entry to the handler and acks it (P5-R1)', async () => {
    await consumer.ensureGroup();
    const event = makeEvent();
    await xadd(event);

    const processed = await consumer.pollOnce({ blockMs: 0 });

    expect(processed).toBe(1);
    expect(handled).toHaveLength(1);
    expect(handled[0]).toEqual(event);
    // Acked: nothing left in the group's pending entries list.
    expect(await pendingEntryIds()).toEqual([]);
  });

  it('runs the side effect exactly once for the same event delivered twice (P5-R3)', async () => {
    await consumer.ensureGroup();
    const event = makeEvent();

    // First delivery: the broker hands the event over.
    await xadd(event);
    const first = await consumer.pollOnce({ blockMs: 0 });

    // Second delivery: the same envelope (same event id) arrives again —
    // the at-least-once case the dedupe marker must absorb.
    await xadd(event);
    const second = await consumer.pollOnce({ blockMs: 0 });

    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(handled).toHaveLength(1);
    expect(handled[0].id).toBe(event.id);
    // Dedupe marker persisted for the event id.
    expect(await client.exists(`processed:${event.id}`)).toBe(1);
    // Both deliveries were acked (the duplicate is cleared, not looped).
    expect(await client.xlen(stream)).toBe(2);
    expect(await pendingEntryIds()).toEqual([]);
  });

  it('does not ack when the handler fails, and retries the pending event after recovery', async () => {
    await consumer.ensureGroup();
    const event = makeEvent();
    await xadd(event);

    let failing = true;
    const retrying = new RedisStreamConsumer({
      redisUrl: REDIS_URL,
      streamName: stream,
      handleEvent: (recovered) => {
        if (failing) {
          throw new Error('side effect failed');
        }
        handled.push(recovered);
      },
    });

    try {
      await expect(retrying.pollOnce({ blockMs: 0 })).rejects.toThrow(
        /side effect failed/
      );

      // No ack and no dedupe marker: the side effect never completed, so
      // the message must stay pending for redelivery.
      expect(await pendingEntryIds()).toEqual([
        expect.stringContaining('-'),
      ]);
      expect(await client.exists(`processed:${event.id}`)).toBe(0);

      // Handler recovers: the pending entry is redelivered and completes.
      failing = false;
      const retried = await retrying.pollOnce({ blockMs: 0 });

      expect(retried).toBe(1);
      expect(handled).toHaveLength(1);
      expect(handled[0].id).toBe(event.id);
      expect(await pendingEntryIds()).toEqual([]);
      expect(await client.exists(`processed:${event.id}`)).toBe(1);
    } finally {
      await retrying.close();
    }
  });

  it('joins the default edunic-worker group on the default stream', async () => {
    const defaultConsumer = new RedisStreamConsumer({
      redisUrl: REDIS_URL,
      handleEvent: () => undefined,
    });

    try {
      const existedBefore =
        (await client.exists('edunic:domain-events')) === 1;
      const beforeNames = await groupNames(client, 'edunic:domain-events');
      const groupPreexisted = beforeNames.includes('edunic-worker');

      await defaultConsumer.ensureGroup();

      const names = await groupNames(client, 'edunic:domain-events');
      expect(names).toContain('edunic-worker');

      // Cleanup only what this test created; never delete pre-existing data.
      if (!groupPreexisted) {
        await client.xgroupDestroy('edunic:domain-events', 'edunic-worker');
      }
      if (!existedBefore && (await client.exists('edunic:domain-events')) === 1) {
        const remaining = await groupNames(client, 'edunic:domain-events');
        if (remaining.length === 0) {
          await client.del('edunic:domain-events');
        }
      }
    } finally {
      await defaultConsumer.close();
    }
  });

  it('creates the group at the stream tip so earlier history is not replayed', async () => {
    const staleEvent = makeEvent();
    await xadd(staleEvent);

    // Group created after the stale entry: it must NOT be consumed.
    await consumer.ensureGroup();
    const beforeGroup = await consumer.pollOnce({ blockMs: 0 });
    expect(beforeGroup).toBe(0);
    expect(handled).toHaveLength(0);

    const liveEvent = makeEvent();
    await xadd(liveEvent);
    const afterGroup = await consumer.pollOnce({ blockMs: 0 });

    expect(afterGroup).toBe(1);
    expect(handled.map((event) => event.id)).toEqual([liveEvent.id]);
  });
});
