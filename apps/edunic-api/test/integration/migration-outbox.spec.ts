import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { db, runMigrations } from '@edunic/source/db';
import { createEventEnvelope } from '@edunic/source/events';
import { ensureTestDatabaseReady } from '../helpers/db.js';

const MIGRATIONS_DIR = 'libs/db/src/migrations';

function buildEvent() {
  return createEventEnvelope({
    name: 'enrollment.created',
    institutionId: randomUUID(),
    payload: { enrollmentId: randomUUID() },
  });
}

async function outboxTableName() {
  const result = await db.execute(
    sql.raw(`SELECT to_regclass('outbox_events') AS name`)
  );
  return (result.rows[0] as { name: string | null }).name;
}

describe('migration 0006 outbox_events (D2)', () => {
  beforeAll(async () => {
    await ensureTestDatabaseReady();
  });

  it('up applies: the table exists and stores a valid outbox event', async () => {
    expect(await outboxTableName()).toBe('outbox_events');

    const event = buildEvent();
    await db.execute(sql`
      insert into outbox_events (id, event, occurred_at)
      values (${event.id}, ${JSON.stringify(event)}::jsonb, now())
    `);

    const result = await db.execute(sql`
      select id, event, published_at
      from outbox_events
      where id = ${event.id}
    `);

    const row = result.rows[0] as {
      id: string;
      event: typeof event;
      published_at: Date | null;
    };

    expect(row.id).toBe(event.id);
    expect(row.event).toEqual(event);
    expect(row.published_at).toBeNull();
  });

  it('bad rows are rejected by the database: NULL event and duplicate id', async () => {
    await expect(
      db.execute(
        sql.raw(
          `insert into outbox_events (id, event) values (gen_random_uuid(), NULL)`
        )
      )
    // Drizzle wraps pg errors (DrizzleQueryError); the pg code rides on `cause`
    // — the same contract handlePersistenceError relies on.
    ).rejects.toMatchObject({ cause: { code: '23502' } });

    const event = buildEvent();
    await db.execute(sql`
      insert into outbox_events (id, event)
      values (${event.id}, ${JSON.stringify(event)}::jsonb)
    `);

    await expect(
      db.execute(sql`
        insert into outbox_events (id, event)
        values (${event.id}, ${JSON.stringify(buildEvent())}::jsonb)
      `)
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('down reverses the migration and up re-applies it cleanly', async () => {
    const downSql = readFileSync(
      `${MIGRATIONS_DIR}/0006_outbox_events.down.sql`,
      'utf8'
    );
    await db.execute(sql.raw(downSql));
    expect(await outboxTableName()).toBeNull();

    const upSql = readFileSync(`${MIGRATIONS_DIR}/0006_outbox_events.sql`, 'utf8');
    await db.execute(sql.raw(upSql));
    expect(await outboxTableName()).toBe('outbox_events');

    // The migrator journal stays consistent: a re-run is a no-op, not an error.
    await expect(runMigrations()).resolves.toBeUndefined();
  });
});
