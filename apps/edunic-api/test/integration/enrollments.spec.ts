import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createAttendanceFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createGradeFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('enrollments routes', () => {
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

  it('supports CRUD for enrollments', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const classroom = await createClassroomFixture({ institutionId: institution.id });
    const headers = createAuthHeaders({
      userId: teacherUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/enrollments').set(headers).send({
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
      status: 'active',
    });

    expect(createResponse.status).toBe(201);
    const enrollmentId = createResponse.body.data.id;

    const duplicateResponse = await client.post('/enrollments').set(headers).send({
      studentId: student.id,
      academicPeriodId: period.id,
    });
    expect(duplicateResponse.status).toBe(409);

    const updateResponse = await client
      .patch(`/enrollments/${enrollmentId}`)
      .set(headers)
      .send({ status: 'completed' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.status).toBe('completed');

    const deleteResponse = await client
      .delete(`/enrollments/${enrollmentId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('filters enrollments by classroom', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const targetClassroom = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 5,
      section: 'A',
    });
    const otherClassroom = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 5,
      section: 'B',
    });
    const firstStudent = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'Ana',
    });
    const secondStudent = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'Luis',
    });
    await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: firstStudent.id,
      academicPeriodId: period.id,
      classroomId: targetClassroom.id,
    });
    await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: secondStudent.id,
      academicPeriodId: period.id,
      classroomId: otherClassroom.id,
    });

    const response = await client
      .get(`/enrollments?classroomId=${targetClassroom.id}`)
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].student.firstName).toBe('Ana');
  });

  it('rejects cross-institution relations', async () => {
    const institution = await createInstitutionFixture('Alpha');
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const otherInstitution = await createInstitutionFixture('Beta');
    const student = await createStudentFixture({ institutionId: otherInstitution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });

    const response = await client
      .post('/enrollments')
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        studentId: student.id,
        academicPeriodId: period.id,
      });

    expect(response.status).toBe(404);
  });

  it('returns 409 when dependent grades or attendance exist on delete', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    await createGradeFixture({
      institutionId: institution.id,
      enrollmentId: enrollment.id,
    });
    await createAttendanceFixture({
      institutionId: institution.id,
      enrollmentId: enrollment.id,
    });

    const response = await client
      .delete(`/enrollments/${enrollment.id}`)
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(409);
  });
});
