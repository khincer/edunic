import Fastify, { type FastifyInstance } from 'fastify';
import { ValidationError } from '@edunic/source/domain/shared';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.plugin.js';

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();

  await app.register(errorHandlerPlugin);

  app.get('/not-found', async () => {
    throw httpError('Student not found', 404);
  });
  app.get('/validation', async () => {
    throw new ValidationError('Invalid request body');
  });
  app.get('/unauthorized', async () => {
    throw httpError('Authentication is required', 401);
  });
  app.get('/forbidden', async () => {
    throw httpError('Insufficient permissions', 403);
  });
  app.get('/conflict', async () => {
    throw httpError('Already enrolled', 409);
  });
  app.get('/unavailable', async () => {
    throw httpError('Service temporarily unavailable', 503);
  });
  app.get('/boom', async () => {
    throw new Error('connection string postgres://user:secret@host');
  });

  await app.ready();
  return app;
}

describe('error handler plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps a 400 domain error to VALIDATION_ERROR', async () => {
    const response = await app.inject({ method: 'GET', url: '/validation' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
    });
  });

  it.each([
    ['/not-found', 404, 'NOT_FOUND', 'Student not found'],
    ['/unauthorized', 401, 'UNAUTHORIZED', 'Authentication is required'],
    ['/forbidden', 403, 'FORBIDDEN', 'Insufficient permissions'],
    ['/conflict', 409, 'CONFLICT', 'Already enrolled'],
    ['/unavailable', 503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable'],
  ])('maps %s to %s / %s', async (url, status, code, message) => {
    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ code, message });
  });

  it('masks unexpected errors as a generic 500 without leaking internals', async () => {
    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
    });
    expect(response.body).not.toContain('postgres://');
  });

  it('attaches a distinct correlation id per request', async () => {
    const first = await app.inject({ method: 'GET', url: '/not-found' });
    const second = await app.inject({ method: 'GET', url: '/not-found' });

    const firstId = first.json().correlationId;
    const secondId = second.json().correlationId;

    expect(typeof firstId).toBe('string');
    expect(firstId.length).toBeGreaterThan(0);
    expect(firstId).not.toBe(secondId);
  });
});
