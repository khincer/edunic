import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('audit logs routes', () => {
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

  it('records successful mutating requests and lists them for admins', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/students').set(headers).send({
      firstName: 'Ana',
      lastName: 'Lopez',
    });

    expect(createResponse.status).toBe(201);

    const logsResponse = await client.get('/audit-logs').set(headers);

    expect(logsResponse.status).toBe(200);
    expect(logsResponse.body.meta.total).toBeGreaterThan(0);
    expect(logsResponse.body.data[0].action).toBe('create');
    expect(logsResponse.body.data[0].entity).toBe('students');
  });

  it('does not allow teachers to read audit logs', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .get('/audit-logs')
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(403);
  });

  it('can filter audit logs by entity', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
    const student = await createStudentFixture({ institutionId: institution.id });

    await client
      .patch(`/students/${student.id}`)
      .set(headers)
      .send({ firstName: 'Updated' });

    const response = await client
      .get('/audit-logs')
      .query({ entity: 'students' })
      .set(headers);

    expect(response.status).toBe(200);
    expect(
      response.body.data.every((item: { entity: string }) => item.entity === 'students')
    ).toBe(true);
  });
});
