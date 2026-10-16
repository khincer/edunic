import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  fetchUnpublishedOutboxEvents,
  markOutboxPublished,
} from '@edunic/source/domain/shared';

const OUTBOX_POLL_INTERVAL_MS = 500;

const outboxPublisherPluginHandler: FastifyPluginAsync = async (app) => {
  let draining = false;

  const drain = async () => {
    if (draining) {
      return;
    }

    draining = true;

    try {
      const rows = await fetchUnpublishedOutboxEvents(app.db);

      // Stop at the first failure so delivery keeps its occurred_at order;
      // the failed row stays unpublished and the next poll retries it.
      for (const row of rows) {
        await app.eventBus.publish(row.event);
        await markOutboxPublished(app.db, row.id);
      }
    } catch (error) {
      app.log.warn({ err: error }, 'outbox publisher drain failed; will retry');
    } finally {
      draining = false;
    }
  };

  const timer = setInterval(() => {
    void drain();
  }, OUTBOX_POLL_INTERVAL_MS);
  timer.unref?.();

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });
};

export const outboxPublisherPlugin = fp(outboxPublisherPluginHandler, {
  name: 'outbox-publisher-plugin',
  dependencies: ['db-plugin', 'event-bus-plugin'],
});
