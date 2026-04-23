import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  app.register(healthRoutes, { prefix: '/health' });
}
