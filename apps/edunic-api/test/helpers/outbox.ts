import { db } from '@edunic/source/db';
import {
  fetchUnpublishedOutboxEvents,
  markOutboxPublished,
} from '@edunic/source/domain/shared';
import type { EventEnvelope } from '@edunic/source/events';

/**
 * Drains pending `outbox_events` rows through the given publisher and marks
 * each row published after its event is delivered (D2: design #922).
 *
 * Uses the same fetch/mark helpers as the production outbox publisher plugin,
 * so tests and the plugin share one drain contract.
 */
export async function flushOutbox(
  publish: (event: EventEnvelope) => Promise<void>
): Promise<number> {
  const rows = await fetchUnpublishedOutboxEvents(db);

  for (const row of rows) {
    await publish(row.event);
    await markOutboxPublished(db, row.id);
  }

  return rows.length;
}
