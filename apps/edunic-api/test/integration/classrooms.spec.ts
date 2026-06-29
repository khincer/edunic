import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('classrooms routes', () => {
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

  it('supports CRUD and duplicate protection', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/classrooms').set(headers).send({
      gradeLevel: 5,
      section: 'A',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.name).toBe('Grade 5 A');
    const classroomId = createResponse.body.data.id;

    const duplicateResponse = await client.post('/classrooms').set(headers).send({
      gradeLevel: 5,
      section: 'A',
    });
    expect(duplicateResponse.status).toBe(409);

    const listResponse = await client
      .get('/classrooms?gradeLevel=5')
      .set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);

    const updateResponse = await client
      .patch(`/classrooms/${classroomId}`)
      .set(headers)
      .send({ section: 'B' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Grade 5 B');

    const deleteResponse = await client
      .delete(`/classrooms/${classroomId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('allows teachers to read classrooms but not mutate them', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    await createClassroomFixture({ institutionId: institution.id });
    const headers = createAuthHeaders({
      userId: teacherUser.id,
      institutionId: institution.id,
    });

    const listResponse = await client.get('/classrooms').set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);

    const createResponse = await client.post('/classrooms').set(headers).send({
      gradeLevel: 6,
      section: 'A',
    });
    expect(createResponse.status).toBe(403);
  });

  it('returns 409 when deleting a classroom with enrollments', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const classroom = await createClassroomFixture({ institutionId: institution.id });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
    });

    const response = await client
      .delete(`/classrooms/${classroom.id}`)
      .set(
        createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(409);
  });
});
