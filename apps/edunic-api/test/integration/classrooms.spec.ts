import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
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
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/classrooms').set(headers).send({
      gradeLevel: 5,
      section: 'A',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.name).toBe('Grade 5 A');
    expect(createResponse.body.data).not.toHaveProperty('institutionId');
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
    for (const item of listResponse.body.data) {
      expect(item).not.toHaveProperty('institutionId');
    }

    // The UNIQUE key still carries institution_id until 0015: with one school
    // the app-level check is what keeps (grade_level, section) unique.
    const sectionB = await client.post('/classrooms').set(headers).send({
      gradeLevel: 5,
      section: 'B',
    });
    expect(sectionB.status).toBe(201);
    const collidingUpdate = await client
      .patch(`/classrooms/${sectionB.body.data.id}`)
      .set(headers)
      .send({ section: 'A' });
    expect(collidingUpdate.status).toBe(409);

    const getResponse = await client.get(`/classrooms/${classroomId}`).set(headers);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data).not.toHaveProperty('institutionId');

    const updateResponse = await client
      .patch(`/classrooms/${classroomId}`)
      .set(headers)
      .send({ section: 'C' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Grade 5 C');

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
    const classroom = await createClassroomFixture({ institutionId: institution.id });
    await createTeacherClassroomAssignmentFixture({
      institutionId: institution.id,
      teacherUserId: teacherUser.id,
      classroomId: classroom.id,
    });
    const headers = await createAuthHeaders({
      userId: teacherUser.id,
      institutionId: institution.id,
    });

    const listResponse = await client.get('/classrooms').set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);
    for (const item of listResponse.body.data) {
      expect(item).not.toHaveProperty('institutionId');
    }

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
      role: 'director',
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
        await createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(409);
  });
});
