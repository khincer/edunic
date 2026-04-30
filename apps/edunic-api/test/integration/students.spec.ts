import { createTestApp, createHttpClient } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
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
    const institution = await createInstitutionFixture();
    const tenantHeaders = { 'x-institution-id': institution.id };

    const createResponse = await client.post('/students').set(tenantHeaders).send({
      firstName: '  Ana  ',
      lastName: '  Lopez ',
      dateOfBirth: '2013-04-10',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.fullName).toBe('Ana Lopez');
    const studentId = createResponse.body.data.id;

    const listResponse = await client.get('/students').set(tenantHeaders);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);

    const detailResponse = await client
      .get(`/students/${studentId}`)
      .set(tenantHeaders);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.id).toBe(studentId);

    const updateResponse = await client
      .patch(`/students/${studentId}`)
      .set(tenantHeaders)
      .send({ firstName: 'Andrea' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.firstName).toBe('Andrea');

    const deleteResponse = await client
      .delete(`/students/${studentId}`)
      .set(tenantHeaders);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data).toEqual({ id: studentId, deleted: true });
  });

  it('returns 400 when tenant header is missing', async () => {
    const response = await client.get('/students');
    expect(response.status).toBe(400);
  });

  it('returns 409 when deleting a student with enrollments', async () => {
    const institution = await createInstitutionFixture();
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });

    const response = await client
      .delete(`/students/${student.id}`)
      .set({ 'x-institution-id': institution.id });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('Student cannot be deleted');
  });
});
