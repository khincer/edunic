import { docsRoutes } from './docs.routes.js';
import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes.js';
import { institutionRoutes } from './institutions.routes.js';
import { studentRoutes } from './students.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  app.register(docsRoutes, { prefix: '/docs' });
  app.register(healthRoutes, { prefix: '/health' });
  app.register(institutionRoutes, { prefix: '/institutions' });
  app.register(studentRoutes, { prefix: '/students' });
}
