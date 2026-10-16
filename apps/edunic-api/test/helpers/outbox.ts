import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import type { EventEnvelope } from '@edunic/source/events';

/**
 * Drains pending `outbox_events` rows through the given publisher and marks
 * each row published after its event is delivered (D2: design #922).
 *
 * Scaffold for slice S2 (tasks 2.2-2.5): the exact `outbox_events` columns
 * land with migration 0006. Until then only the documented expected-red test
 * in `outbox-atomicity.spec.ts` references this helper and stays skipped.
 */
export async function flushOutbox(
  publish: (event: EventEnvelope) => Promise<void>
): Promise<number> {
  const rows = (await db.execute(sql.raw(`
    SELECT id, event
    FROM outbox_events
    WHERE published_at IS NULL
    ORDER BY occurred_at, id
  `))) as unknown as { id: string; event: EventEnvelope }[];

  for (const row of rows) {
    await publish(row.event);
    await db.execute(
      sql`UPDATE outbox_events SET published_at = NOW() WHERE id = ${row.id}`
    );
  }

  return rows.length;
}
