import { createTestApp, createHttpClient } from '../helpers/app.js';
import { ensureTestDatabaseReady } from '../helpers/db.js';

describe('health routes', () => {
  beforeAll(async () => {
    await ensureTestDatabaseReady();
  });

  it('returns healthy responses for /health and /health/db', async () => {
    const app = await createTestApp();
    const client = createHttpClient(app);

    const healthResponse = await client.get('/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toMatchObject({
      status: 'ok',
      database: 'ok',
    });

    const dbResponse = await client.get('/health/db');
    expect(dbResponse.status).toBe(200);
    expect(dbResponse.body.status).toBe('ok');
    expect(Array.isArray(dbResponse.body.result)).toBe(true);

    await app.close();
  });
});
