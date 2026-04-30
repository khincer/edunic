import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import {
  closeTestDatabase,
  ensureTestDatabaseReady,
  resetTestDatabase,
} from './db.js';

export async function createTestApp() {
  await ensureTestDatabaseReady();
  const app = await buildApp();
  await app.ready();
  return app;
}

export function createHttpClient(app: FastifyInstance) {
  return request(app.server);
}

export async function setupIntegrationApp() {
  const app = await createTestApp();

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDatabase();
  });

  return {
    app,
    request: createHttpClient(app),
  };
}
