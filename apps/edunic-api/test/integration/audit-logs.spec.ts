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
      role: 'director',
    });
    const headers = await createAuthHeaders({
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
    expect(logsResponse.body.data[0]).not.toHaveProperty('institutionId');
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
        await createAuthHeaders({
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
      role: 'director',
    });
    const headers = await createAuthHeaders({
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

  // The entity id of a route without a path param falls back to the response
  // data id. The school profile has no :institutionId param any more.
  it('audits a school profile update with the school id taken from the response', async () => {
    const institution = await createInstitutionFixture('Colegio Central');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const updated = await client
      .patch('/school-profile')
      .set(headers)
      .send({ senderName: 'Colegio Central' });
    expect(updated.status).toBe(200);

    const response = await client
      .get('/audit-logs')
      .query({ entity: 'school_profile' })
      .set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      action: 'update',
      entity: 'school_profile',
      entityId: institution.id,
    });
  });
});
