import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createClassroomSubjectFixture,
  createSubjectFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('grades routes', () => {
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

  it('supports CRUD for grades', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const classroom = await createClassroomFixture({
      institutionId: institution.id,
    });
    await createTeacherClassroomAssignmentFixture({
      institutionId: institution.id,
      teacherUserId: teacherUser.id,
      classroomId: classroom.id,
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
    });
    const headers = await createAuthHeaders({
      userId: teacherUser.id,
      institutionId: institution.id,
    });

    // The teacher owns the materia of their classroom.
    const subject = await createSubjectFixture('Mathematics');
    await createClassroomSubjectFixture(classroom.id, subject.id);

    const createResponse = await client.post('/grades').set(headers).send({
      enrollmentId: enrollment.id,
      subjectId: subject.id,
      score: 88,
    });

    expect(createResponse.status).toBe(201);
    const gradeId = createResponse.body.data.id;

    const updateResponse = await client
      .patch(`/grades/${gradeId}`)
      .set(headers)
      .send({ score: 91 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.score).toBe(91);

    const listResponse = await client.get('/grades').set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);

    const deleteResponse = await client
      .delete(`/grades/${gradeId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('returns 404 when the enrollment does not exist', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .post('/grades')
      .set(
        await createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        enrollmentId: '99999999-9999-4999-8999-999999999999',
        subjectId: (await createSubjectFixture('Science')).id,
        score: 95,
      });

    expect(response.status).toBe(404);
  });

  it('answers without institutionId and keeps naming the materia', async () => {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });
    const subject = await createSubjectFixture('Science');

    const created = await client.post('/grades').set(headers).send({
      enrollmentId: enrollment.id,
      subjectId: subject.id,
      score: 77,
    });
    expect(created.status).toBe(201);
    expect(created.body.data).not.toHaveProperty('institutionId');
    expect(created.body.data).toMatchObject({
      subjectId: subject.id,
      subject: 'Science',
    });

    const fetched = await client
      .get(`/grades/${created.body.data.id}`)
      .set(headers);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).not.toHaveProperty('institutionId');

    const listed = await client.get('/grades').set(headers);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).not.toHaveProperty('institutionId');
    expect(listed.body.data[0].subject).toBe('Science');

    const missing = await client
      .get('/grades/99999999-9999-4999-8999-999999999999')
      .set(headers);
    expect(missing.status).toBe(404);
  });
});
