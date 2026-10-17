import { createTestApp, createHttpClient } from '../helpers/app.js';
import { ensureTestDatabaseReady } from '../helpers/db.js';

describe('health routes', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    await ensureTestDatabaseReady();
    app = await createTestApp();
    client = createHttpClient(app);
  });

  // Cleanup lives in afterAll so a failing assertion cannot leak the app
  // (and its server/pool handles) and hang the Jest process.
  afterAll(async () => {
    await app.close();
  });

  it('reports liveness without consulting dependencies', async () => {
    const healthResponse = await client.get('/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ status: 'ok' });

    const dbResponse = await client.get('/health/db');
    expect(dbResponse.status).toBe(200);
    expect(dbResponse.body.status).toBe('ok');
    expect(Array.isArray(dbResponse.body.result)).toBe(true);
  });
});

describe('health routes with the database unreachable', () => {
  const previousUrl = process.env.DATABASE_URL;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    // Dead port: connection refused, without touching the shared test database
    // (the module-level pool was created from the real DATABASE_URL at import).
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:1/invalid';
    app = await createTestApp();
    client = createHttpClient(app);
  });

  afterAll(async () => {
    await app.close();
    process.env.DATABASE_URL = previousUrl;
  });

  it('returns 200 from /health even when the database is down', async () => {
    const healthResponse = await client.get('/health');

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ status: 'ok' });
  });

  it('keeps /health/db reporting the failure with 503', async () => {
    const dbResponse = await client.get('/health/db');

    expect(dbResponse.status).toBe(503);
    expect(dbResponse.body.status).toBe('error');
    expect(typeof dbResponse.body.message).toBe('string');
  });
});

describe('readiness route', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports ready when every dependency answers', async () => {
    const response = await client.get('/ready');

    expect(response.status).toBe(200);
    // Raw body, no `data` envelope key — /ready stays out of the envelope.
    expect(response.body).toEqual({ status: 'ready', failing: [] });
  });
});

describe('readiness route with the database unreachable', () => {
  const previousUrl = process.env.DATABASE_URL;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:1/invalid';
    app = await createTestApp();
    client = createHttpClient(app);
  });

  afterAll(async () => {
    await app.close();
    process.env.DATABASE_URL = previousUrl;
  });

  it('answers 503 naming the database as the failing dependency', async () => {
    const response = await client.get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', failing: ['database'] });
  });
});

describe('readiness route with Redis unreachable', () => {
  const previousRedisUrl = process.env.IDEMPOTENCY_REDIS_URL;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    // Dead port: connection refused, the same isolation used by the
    // idempotency Redis-down suite.
    process.env.IDEMPOTENCY_REDIS_URL = 'redis://127.0.0.1:6399';
    app = await createTestApp();
    client = createHttpClient(app);
  });

  afterAll(async () => {
    await app.close();
    if (previousRedisUrl === undefined) {
      delete process.env.IDEMPOTENCY_REDIS_URL;
    } else {
      process.env.IDEMPOTENCY_REDIS_URL = previousRedisUrl;
    }
  });

  it('answers 503 naming redis as the failing dependency', async () => {
    const response = await client.get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', failing: ['redis'] });
  });
});

describe('readiness route with the redis event bus unreachable', () => {
  const previousBackend = process.env.EVENT_BUS_BACKEND;
  const previousRedisUrl = process.env.REDIS_URL;
  const previousIdempotencyRedisUrl = process.env.IDEMPOTENCY_REDIS_URL;
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    process.env.EVENT_BUS_BACKEND = 'redis';
    process.env.REDIS_URL = 'redis://127.0.0.1:6399';
    // resolveApiRedisUrl() prefers the idempotency URL, so a live value here
    // would mask the outage the scenario simulates.
    process.env.IDEMPOTENCY_REDIS_URL = 'redis://127.0.0.1:6399';
    app = await createTestApp();
    client = createHttpClient(app);
  });

  afterAll(async () => {
    await app.close();
    if (previousBackend === undefined) {
      delete process.env.EVENT_BUS_BACKEND;
    } else {
      process.env.EVENT_BUS_BACKEND = previousBackend;
    }
    if (previousRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousRedisUrl;
    }
    if (previousIdempotencyRedisUrl === undefined) {
      delete process.env.IDEMPOTENCY_REDIS_URL;
    } else {
      process.env.IDEMPOTENCY_REDIS_URL = previousIdempotencyRedisUrl;
    }
  });

  it('answers 503 naming redis and the event bus as failing dependencies', async () => {
    const response = await client.get('/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      failing: ['redis', 'event-bus'],
    });
  });
});
