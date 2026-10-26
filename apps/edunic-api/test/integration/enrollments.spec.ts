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
  createTeacherClassroomAssignmentFixture,
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
    await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      role: 'teacher',
    });
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    const classroom = await createClassroomFixture({});
    const headers = await createAuthHeaders({
      userId: teacherUser.id,
    });

    const createResponse = await client.post('/enrollments').set(headers).send({
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
      status: 'active',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data).not.toHaveProperty('institutionId');
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
    await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      role: 'teacher',
    });
    const period = await createAcademicPeriodFixture({});
    const targetClassroom = await createClassroomFixture({
      gradeLevel: 5,
      section: 'A',
    });
    const otherClassroom = await createClassroomFixture({
      gradeLevel: 5,
      section: 'B',
    });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacherUser.id,
      classroomId: targetClassroom.id,
    });
    const firstStudent = await createStudentFixture({
      firstName: 'Ana',
    });
    const secondStudent = await createStudentFixture({
      firstName: 'Luis',
    });
    await createEnrollmentFixture({
      studentId: firstStudent.id,
      academicPeriodId: period.id,
      classroomId: targetClassroom.id,
    });
    await createEnrollmentFixture({
      studentId: secondStudent.id,
      academicPeriodId: period.id,
      classroomId: otherClassroom.id,
    });

    const response = await client
      .get(`/enrollments?classroomId=${targetClassroom.id}`)
      .set(
        await createAuthHeaders({
          userId: teacherUser.id,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].student.firstName).toBe('Ana');
    expect(response.body.data[0]).not.toHaveProperty('institutionId');
  });

  it('returns 404 for an unknown student, period or classroom', async () => {
    await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      role: 'teacher',
    });
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    const headers = await createAuthHeaders({
      userId: teacherUser.id,
    });
    const unknown = '00000000-0000-4000-8000-000000000000';

    const post = (body: Record<string, unknown>) =>
      client.post('/enrollments').set(headers).send(body);

    expect(
      (await post({ studentId: unknown, academicPeriodId: period.id })).status
    ).toBe(404);
    expect(
      (await post({ studentId: student.id, academicPeriodId: unknown })).status
    ).toBe(404);
    expect(
      (
        await post({
          studentId: student.id,
          academicPeriodId: period.id,
          classroomId: unknown,
        })
      ).status
    ).toBe(404);
  });

  it('returns 409 when dependent grades or attendance exist on delete', async () => {
    await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      role: 'teacher',
    });
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    const enrollment = await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: period.id,
    });
    await createGradeFixture({
      enrollmentId: enrollment.id,
    });
    await createAttendanceFixture({
      enrollmentId: enrollment.id,
    });

    const response = await client
      .delete(`/enrollments/${enrollment.id}`)
      .set(
        await createAuthHeaders({
          userId: teacherUser.id,
        })
      );

    expect(response.status).toBe(409);
  });
});
