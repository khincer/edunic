import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createBearerToken } from '../helpers/auth.js';
import { ensureTestDatabaseReady, resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('admin bootstrap route', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs migration and seed successfully', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const response = await client
      .post('/admin/bootstrap')
      .set({
        authorization: `Bearer ${createBearerToken({
          userId: adminUser.id,
          institutionId: institution.id,
        })}`,
      })
      .send();

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      migration: 'ok',
      seed: 'ok',
    });
    expect(typeof response.body.data.durationMs).toBe('number');
  });

  it('returns 500 when migration fails', async () => {
    await ensureTestDatabaseReady();
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://invalid:invalid@127.0.0.1:1/invalid';

    const response = await client
      .post('/admin/bootstrap')
      .set({
        authorization: `Bearer ${createBearerToken({
          userId: adminUser.id,
          institutionId: institution.id,
        })}`,
      })
      .send();

    process.env.DATABASE_URL = originalDatabaseUrl;

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('Bootstrap failed during migration');
  });
});
