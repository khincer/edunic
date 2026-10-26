import { db } from '@edunic/source/db';
import { guardianUserLinks, studentGuardians } from '@edunic/source/db/schema';
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
    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });
    const student = await createStudentFixture({});
    const headers = await createAuthHeaders({
      userId: adminUser.id,
    });

    const createResponse = await client.post('/guardians').set(headers).send({
      name: '  Maria Lopez ',
      phone: '+50255550000',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).not.toHaveProperty('institutionId');
    const guardianId = createResponse.body.data.id;

    const linkResponse = await client
      .post(`/students/${student.id}/guardians/${guardianId}`)
      .set(headers)
      .send();
    expect(linkResponse.status).toBe(201);
    expect(linkResponse.body.data.guardian).not.toHaveProperty('institutionId');

    const duplicateLinkResponse = await client
      .post(`/students/${student.id}/guardians/${guardianId}`)
      .set(headers)
      .send();
    expect(duplicateLinkResponse.status).toBe(409);

    const listResponse = await client
      .get(`/students/${student.id}/guardians`)
      .set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0]).not.toHaveProperty('institutionId');

    const guardianList = await client.get('/guardians').set(headers);
    expect(guardianList.status).toBe(200);
    expect(guardianList.body.data).toHaveLength(1);
    expect(guardianList.body.data[0]).not.toHaveProperty('institutionId');

    const deleteWhileLinkedResponse = await client
      .delete(`/guardians/${guardianId}`)
      .set(headers);
    expect(deleteWhileLinkedResponse.status).toBe(409);

    const unlinkResponse = await client
      .delete(`/students/${student.id}/guardians/${guardianId}`)
      .set(headers);
    expect(unlinkResponse.status).toBe(200);

    const unlinkAgainResponse = await client
      .delete(`/students/${student.id}/guardians/${guardianId}`)
      .set(headers);
    expect(unlinkAgainResponse.status).toBe(404);

    const deleteResponse = await client
      .delete(`/guardians/${guardianId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('prevents parent users from mutating guardians', async () => {
    await createInstitutionFixture();
    const parentUser = await createUserFixture({
      role: 'parent',
    });

    const response = await client
      .post('/guardians')
      .set(
        await createAuthHeaders({
          userId: parentUser.id,
        })
      )
      .send({
        name: 'Maria Lopez',
      });

    expect(response.status).toBe(403);
  });

  it('persists a guardian email and reads it back', async () => {
    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
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
    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
    });
    const guardian = await createGuardianFixture({});

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
    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
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

  // Reading a guardian is scoped to the family of the parent (PAR-04): the
  // guardian must be linked to one of the parent's own children.
  it('allows parent users to read the guardians of their own children', async () => {
    await createInstitutionFixture();
    const parentUser = await createUserFixture({
      role: 'parent',
    });
    const student = await createStudentFixture({});
    const guardian = await createGuardianFixture({});
    const unrelated = await createGuardianFixture({});
    await db.insert(studentGuardians).values({
      studentId: student.id,
      guardianId: guardian.id,
    });
    await db.insert(guardianUserLinks).values({
      guardianId: guardian.id,
      userId: parentUser.id,
    });
    const headers = await createAuthHeaders({
      userId: parentUser.id,
    });

    const own = await client.get(`/guardians/${guardian.id}`).set(headers);
    const other = await client.get(`/guardians/${unrelated.id}`).set(headers);

    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
  });
});
