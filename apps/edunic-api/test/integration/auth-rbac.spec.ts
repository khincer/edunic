import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('auth and RBAC routes', () => {
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

  it('logs in with valid credentials and returns a token', async () => {
    const institution = await createInstitutionFixture();
    const user = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
      email: 'admin@example.com',
      password: 'admin1234',
    });

    const response = await client.post('/auth/login').send({
      email: user.email,
      password: user.password,
      institutionId: institution.id,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe('admin');
    expect(typeof response.body.data.token).toBe('string');
  });

  it('rejects invalid credentials', async () => {
    const institution = await createInstitutionFixture();
    await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
      email: 'admin@example.com',
      password: 'admin1234',
    });

    const response = await client.post('/auth/login').send({
      email: 'admin@example.com',
      password: 'wrong-pass',
      institutionId: institution.id,
    });

    expect(response.status).toBe(401);
  });

  it('prevents parent role from mutating students', async () => {
    const institution = await createInstitutionFixture();
    const parentUser = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });

    const response = await client
      .post('/students')
      .set(
        createAuthHeaders({
          userId: parentUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        firstName: 'Ana',
        lastName: 'Lopez',
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('permission');
  });

  it('prevents teacher role from accessing institution management routes', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .get('/institutions')
      .set({
        authorization: createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        }).authorization,
      });

    expect(response.status).toBe(403);
  });
});
