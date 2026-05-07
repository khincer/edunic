import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createEventBusFromEnv } from '../events.js';

const eventBusPluginHandler: FastifyPluginAsync = async (app) => {
  app.decorate('eventBus', createEventBusFromEnv());
};

export const eventBusPlugin = fp(eventBusPluginHandler, {
  name: 'event-bus-plugin',
});
