import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createEventEnvelope, type EventEnvelope } from '@edunic/source/events';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';

// Comfortably more than two publisher poll cycles (500 ms each).
const POLL_WAIT_MS = 1200;

function buildEvent() {
  return createEventEnvelope({
    name: 'enrollment.created',
    institutionId: randomUUID(),
    payload: { enrollmentId: randomUUID() },
  });
}

async function seedOutboxRow(event: EventEnvelope) {
  await db.execute(sql`
    insert into outbox_events (id, event, occurred_at)
    values (${event.id}, ${JSON.stringify(event)}::jsonb, now())
  `);
}

async function countUnpublished() {
  const result = await db.execute(
    sql.raw(
      'SELECT COUNT(*)::int AS count FROM outbox_events WHERE published_at IS NULL'
    )
  );
  return (result.rows[0] as { count: number }).count;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('outbox publisher plugin (D2)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let originalPublish: typeof app.eventBus.publish;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
    originalPublish = app.eventBus.publish.bind(app.eventBus);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    app.eventBus.publish = originalPublish;
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes committed-but-unpublished outbox rows and marks them published', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    app.eventBus.publish = publish;

    const event = buildEvent();
    await seedOutboxRow(event);

    await sleep(POLL_WAIT_MS);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(event);
    expect(await countUnpublished()).toBe(0);
  });

  it('keeps the row unpublished when publish fails so the next poll retries', async () => {
    const publish = jest
      .fn()
      .mockRejectedValue(new Error('event bus down (injected)'));
    app.eventBus.publish = publish;

    const event = buildEvent();
    await seedOutboxRow(event);

    await sleep(POLL_WAIT_MS);

    expect(publish.mock.calls.length).toBeGreaterThan(0);
    expect(await countUnpublished()).toBe(1);
  });

  it('does not republish a row once it has been marked published', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    app.eventBus.publish = publish;

    const event = buildEvent();
    await seedOutboxRow(event);

    await sleep(POLL_WAIT_MS);
    expect(publish).toHaveBeenCalledTimes(1);

    await sleep(POLL_WAIT_MS);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(await countUnpublished()).toBe(0);
  });
});
