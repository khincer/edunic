import Fastify, { type FastifyInstance } from 'fastify';
import { envelopePlugin } from '../../src/plugins/envelope.plugin.js';

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();

  await app.register(envelopePlugin);

  app.get('/raw', async () => ({ status: 'ok', database: 'ok' }));
  app.get('/enveloped', async () => ({ data: { id: '1' }, meta: { total: 1 } }));
  app.get('/array', async () => [{ id: '1' }]);
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/pdf', async (_request, reply) =>
    reply.type('application/pdf').send(Buffer.from('%PDF-1.4'))
  );
  app.get('/boom', async () => {
    throw new Error('unexpected failure');
  });

  await app.ready();
  return app;
}

describe('envelope plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps a raw JSON success response in a data envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/raw' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ data: { status: 'ok', database: 'ok' } });
  });

  it('leaves an already-enveloped response untouched (idempotent)', async () => {
    const response = await app.inject({ method: 'GET', url: '/enveloped' });

    expect(response.json()).toEqual({ data: { id: '1' }, meta: { total: 1 } });
  });

  it('wraps a raw JSON array in a data envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/array' });

    expect(response.json()).toEqual({ data: [{ id: '1' }] });
  });

  it('does not wrap non-JSON responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/pdf' });

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body).toBe('%PDF-1.4');
  });

  it('does not wrap excluded operational endpoints', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('does not wrap error responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json().data).toBeUndefined();
    expect(response.json().message).toBe('unexpected failure');
  });
});
