import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EventEnvelope } from '@edunic/source/events';

// Minimal executor surface shared by the drizzle database and its
// transactions; outbox writes take the caller's executor so they
// participate in the surrounding transaction (design D2).
export type DbExecutor = Pick<NodePgDatabase, 'execute'>;

export type OutboxEventRow = {
  id: string;
  event: EventEnvelope;
};

// Stages an outbox row inside the caller's transaction. The row id is the
// event envelope id, so delivery is identifiable end-to-end.
export async function insertOutboxEvent(
  executor: DbExecutor,
  event: EventEnvelope
): Promise<string> {
  await executor.execute(sql`
    insert into outbox_events (id, event, occurred_at)
    values (${event.id}, ${JSON.stringify(event)}::jsonb, now())
  `);

  return event.id;
}

export async function markOutboxPublished(
  executor: DbExecutor,
  eventId: string
): Promise<void> {
  await executor.execute(sql`
    update outbox_events
    set published_at = now()
    where id = ${eventId}
      and published_at is null
  `);
}

export async function fetchUnpublishedOutboxEvents(
  executor: DbExecutor
): Promise<OutboxEventRow[]> {
  const result = await executor.execute<OutboxEventRow>(sql`
    select id, event
    from outbox_events
    where published_at is null
    order by occurred_at, id
  `);

  return result.rows;
}
