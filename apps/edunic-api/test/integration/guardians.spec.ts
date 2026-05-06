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
      role: 'admin',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = createAuthHeaders({
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
        createAuthHeaders({
          userId: parentUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        name: 'Maria Lopez',
      });

    expect(response.status).toBe(403);
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
        createAuthHeaders({
          userId: parentUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(200);
  });
});
