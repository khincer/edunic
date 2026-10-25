import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('guardians routes', () => {
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

  it('supports guardian CRUD and student linking for admin users', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/guardians').set(headers).send({
      name: '  Maria Lopez ',
      phone: '+50255550000',
    });

    expect(createResponse.status).toBe(201);
    const guardianId = createResponse.body.data.id;

    const linkResponse = await client
      .post(`/students/${student.id}/guardians/${guardianId}`)
      .set(headers)
      .send();
    expect(linkResponse.status).toBe(201);

    const listResponse = await client
      .get(`/students/${student.id}/guardians`)
      .set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);

    const deleteWhileLinkedResponse = await client
      .delete(`/guardians/${guardianId}`)
      .set(headers);
    expect(deleteWhileLinkedResponse.status).toBe(409);

    const unlinkResponse = await client
      .delete(`/students/${student.id}/guardians/${guardianId}`)
      .set(headers);
    expect(unlinkResponse.status).toBe(200);

    const deleteResponse = await client
      .delete(`/guardians/${guardianId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('prevents parent users from mutating guardians', async () => {
    const institution = await createInstitutionFixture();
    const parentUser = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });

    const response = await client
      .post('/guardians')
      .set(
        await createAuthHeaders({
          userId: parentUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        name: 'Maria Lopez',
      });

    expect(response.status).toBe(403);
  });

  it('persists a guardian email and reads it back', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/guardians').set(headers).send({
      name: 'Maria Lopez',
      email: '  maria.lopez@example.com  ',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.email).toBe('maria.lopez@example.com');

    const guardianId = createResponse.body.data.id;

    const detailResponse = await client
      .get(`/guardians/${guardianId}`)
      .set(headers);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.email).toBe('maria.lopez@example.com');

    const listResponse = await client.get('/guardians').set(headers);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].id).toBe(guardianId);
    expect(listResponse.body.data[0].email).toBe('maria.lopez@example.com');
  });

  it('rejects malformed guardian emails on create and update', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
    const guardian = await createGuardianFixture({
      institutionId: institution.id,
    });

    const createResponse = await client.post('/guardians').set(headers).send({
      name: 'Maria Lopez',
      email: 'not-an-email',
    });

    expect(createResponse.status).toBe(400);

    const updateResponse = await client
      .patch(`/guardians/${guardian.id}`)
      .set(headers)
      .send({ email: 'maria(at)example.com' });

    expect(updateResponse.status).toBe(400);

    const unchangedResponse = await client
      .get(`/guardians/${guardian.id}`)
      .set(headers);

    expect(unchangedResponse.body.data.email).toBeNull();
  });

  it('normalises blank guardian emails to null', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const blankCreateResponse = await client
      .post('/guardians')
      .set(headers)
      .send({ name: 'No Email', email: '' });

    expect(blankCreateResponse.status).toBe(201);
    expect(blankCreateResponse.body.data.email).toBeNull();

    const createResponse = await client.post('/guardians').set(headers).send({
      name: 'Maria Lopez',
      email: 'maria.lopez@example.com',
    });

    expect(createResponse.body.data.email).toBe('maria.lopez@example.com');

    const updateResponse = await client
      .patch(`/guardians/${createResponse.body.data.id}`)
      .set(headers)
      .send({ email: '   ' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.email).toBeNull();

    const detailResponse = await client
      .get(`/guardians/${createResponse.body.data.id}`)
      .set(headers);

    expect(detailResponse.body.data.email).toBeNull();
  });

  it('allows parent users to read guardians', async () => {
    const institution = await createInstitutionFixture();
    const parentUser = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    const guardian = await createGuardianFixture({ institutionId: institution.id });

    const response = await client
      .get(`/guardians/${guardian.id}`)
      .set(
        await createAuthHeaders({
          userId: parentUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(200);
  });
});
