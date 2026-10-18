import Fastify, { type FastifyInstance } from 'fastify';
import { errorHandlerPlugin } from '../../src/plugins/error-handler.plugin.js';

// P4-R5 / D6: logs are structured JSON and request-scoped log lines carry the
// correlationId that also lands in the error envelope. Fastify's own lifecycle
// lines ("incoming request"/"request completed") are emitted through the
// pre-hook child logger, so the assertions target lines the application
// emits through request.log — exactly what the onRequest child binding covers.
describe('structured logging (P4-R5, D6)', () => {
  let app: FastifyInstance;
  let lines: string[];

  beforeAll(async () => {
    lines = [];
    app = Fastify({
      logger: {
        level: 'info',
        stream: {
          write: (msg: string) => {
            lines.push(msg);
          },
        },
      },
    });

    await app.register(errorHandlerPlugin);

    app.get('/boom', async () => {
      throw new Error('database connection lost');
    });
    app.get('/missing', async () => {
      throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    });
    app.get('/fine', async (request) => {
      request.log.info('handling /fine');
      return { ok: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function parsedLines() {
    return lines.map((line) => JSON.parse(line));
  }

  function errorLines() {
    return parsedLines().filter((entry) => entry.level === 50);
  }

  function fineLines() {
    return parsedLines().filter((entry) => entry.msg === 'handling /fine');
  }

  it('logs a handled 500 as JSON with err and the envelope correlationId', async () => {
    lines.length = 0;
    const response = await app.inject({ method: 'GET', url: '/boom' });

    expect(response.statusCode).toBe(500);
    const correlationId = response.json().correlationId;
    expect(typeof correlationId).toBe('string');

    const [errorLine] = errorLines();
    expect(errorLine).toBeDefined();
    expect(typeof errorLine.time).toBe('number');
    expect(errorLine.err).toMatchObject({
      type: 'Error',
      message: 'database connection lost',
    });
    expect(typeof errorLine.err.stack).toBe('string');
    expect(errorLine.correlationId).toBe(correlationId);
  });

  it('binds the correlationId onto every request-scoped log line', async () => {
    lines.length = 0;
    await app.inject({ method: 'GET', url: '/fine' });

    const [infoLine] = fineLines();
    expect(infoLine).toBeDefined();
    expect(typeof infoLine.correlationId).toBe('string');
    expect(infoLine.correlationId.length).toBeGreaterThan(0);
  });

  it('gives each request its own correlationId in the logs', async () => {
    lines.length = 0;
    await app.inject({ method: 'GET', url: '/fine' });
    await app.inject({ method: 'GET', url: '/fine' });

    const ids = fineLines().map((entry) => entry.correlationId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('keeps the correlationId bound for expected errors too (triangulation)', async () => {
    lines.length = 0;
    const response = await app.inject({ method: 'GET', url: '/missing' });

    expect(response.statusCode).toBe(404);
    const [errorLine] = errorLines();
    expect(errorLine).toBeDefined();
    expect(errorLine.correlationId).toBe(response.json().correlationId);
    expect(errorLine.err).toMatchObject({ message: 'Student not found' });
  });
});
