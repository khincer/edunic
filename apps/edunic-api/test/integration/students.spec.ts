import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('students routes', () => {
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

  it('supports full CRUD for tenant-scoped students', async () => {
    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });
    const tenantHeaders = await createAuthHeaders({
      userId: adminUser.id,
    });

    const createResponse = await client.post('/students').set(tenantHeaders).send({
      firstName: '  Ana  ',
      secondName: '   ',
      firstLastName: '  Lopez ',
      secondLastName: ' Ruiz ',
      dateOfBirth: '2013-04-10',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.fullName).toBe('Ana Lopez Ruiz');
    expect(createResponse.body.data.secondName).toBeNull();
    expect(createResponse.body.data).not.toHaveProperty('institutionId');
    const studentId = createResponse.body.data.id;

    const listResponse = await client.get('/students').set(tenantHeaders);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);

    const detailResponse = await client
      .get(`/students/${studentId}`)
      .set(tenantHeaders);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.id).toBe(studentId);
    expect(detailResponse.body.data).not.toHaveProperty('institutionId');
    expect(listResponse.body.data[0]).not.toHaveProperty('institutionId');

    const updateResponse = await client
      .patch(`/students/${studentId}`)
      .set(tenantHeaders)
      .send({ firstName: 'Andrea' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.firstName).toBe('Andrea');
    expect(updateResponse.body.data).not.toHaveProperty('institutionId');

    const deleteResponse = await client
      .delete(`/students/${studentId}`)
      .set(tenantHeaders);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data).toEqual({ id: studentId, deleted: true });
  });

  it('requires the second last name when creating a student', async () => {
    const adminUser = await createUserFixture({ role: 'director' });

    const response = await client
      .post('/students')
      .set(await createAuthHeaders({ userId: adminUser.id }))
      .send({ firstName: 'Ana', firstLastName: 'Lopez' });

    expect(response.status).toBe(400);
  });

  it('searches across all four name parts', async () => {
    const adminUser = await createUserFixture({ role: 'director' });
    const headers = await createAuthHeaders({ userId: adminUser.id });
    await createStudentFixture({
      firstName: 'Ana',
      secondName: 'Lucia',
      firstLastName: 'Lopez',
      secondLastName: 'Herrera',
    });
    await createStudentFixture({ firstName: 'Beto', firstLastName: 'Mora' });

    for (const term of ['lucia', 'herrera', 'lopez', 'ana']) {
      const response = await client
        .get(`/students?search=${term}`)
        .set(headers);

      expect(response.status).toBe(200);
      expect(
        response.body.data.map((student: { fullName: string }) => student.fullName)
      ).toEqual(['Ana Lucia Lopez Herrera']);
    }
  });

  it('returns 400 when tenant header is missing', async () => {
    const response = await client.get('/students');
    expect(response.status).toBe(401);
  });

  it('returns 409 when deleting a student with enrollments', async () => {
    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: period.id,
    });

    const response = await client
      .delete(`/students/${student.id}`)
      .set(
        await createAuthHeaders({
          userId: adminUser.id,
        })
      );

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('Student cannot be deleted');
  });
});
