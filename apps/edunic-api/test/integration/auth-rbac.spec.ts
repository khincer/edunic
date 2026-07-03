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

  it('does not reveal whether valid credentials lack a tenant role', async () => {
    const assignedInstitution = await createInstitutionFixture('Assigned Institution');
    const otherInstitution = await createInstitutionFixture('Other Institution');
    const user = await createUserFixture({
      institutionId: assignedInstitution.id,
      role: 'admin',
      email: 'tenant-admin@example.com',
      password: 'admin1234',
    });

    const response = await client.post('/auth/login').send({
      email: user.email,
      password: user.password,
      institutionId: otherInstitution.id,
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid credentials');
  });

  it('rate limits repeated failed login attempts', async () => {
    const institution = await createInstitutionFixture();
    const user = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
      email: 'locked-admin@example.com',
      password: 'admin1234',
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await client.post('/auth/login').send({
        email: user.email,
        password: 'wrong-pass',
        institutionId: institution.id,
      });

      expect(response.status).toBe(401);
    }

    const lockedResponse = await client.post('/auth/login').send({
      email: user.email,
      password: user.password,
      institutionId: institution.id,
    });

    expect(lockedResponse.status).toBe(429);
  });

  it('rejects expired bearer tokens', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });

    const response = await client.get('/institutions').set({
      authorization: createAuthHeaders({
        userId: adminUser.id,
        institutionId: institution.id,
        expiresAt: Math.floor(Date.now() / 1000) - 1,
      }).authorization,
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Token expired');
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
