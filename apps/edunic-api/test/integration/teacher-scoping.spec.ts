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

describe('teacher write scoping', () => {
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

  // One school, two classrooms: the teacher owns the first one only.
  async function createSchool() {
    const institution = await createInstitutionFixture();
    const period = await createAcademicPeriodFixture({
      institutionId: institution.id,
    });
    const ownClassroom = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 5,
      section: 'A',
    });
    const otherClassroom = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 6,
      section: 'B',
    });

    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    await createTeacherClassroomAssignmentFixture({
      institutionId: institution.id,
      teacherUserId: teacher.id,
      classroomId: ownClassroom.id,
    });

    const ownStudent = await createStudentFixture({
      institutionId: institution.id,
    });
    const otherStudent = await createStudentFixture({
      institutionId: institution.id,
    });

    const ownEnrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: ownStudent.id,
      academicPeriodId: period.id,
      classroomId: ownClassroom.id,
    });
    const otherEnrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: otherStudent.id,
      academicPeriodId: period.id,
      classroomId: otherClassroom.id,
    });

    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });

    // The teacher teaches one materia, in their own classroom.
    const subject = await createSubjectFixture('Matem?ticas');
    await createClassroomSubjectFixture(ownClassroom.id, subject.id);

    return {
      subjectId: subject.id,
      institution,
      ownEnrollment,
      otherEnrollment,
      teacherHeaders: await createAuthHeaders({
        userId: teacher.id,
        institutionId: institution.id,
      }),
      adminHeaders: await createAuthHeaders({
        userId: admin.id,
        institutionId: institution.id,
      }),
    };
  }

  it('lets a teacher record a grade for their own classroom', async () => {
    const { ownEnrollment, teacherHeaders, subjectId } = await createSchool();

    const response = await client
      .post('/grades')
      .set(teacherHeaders)
      .send({
        enrollmentId: ownEnrollment.id,
        subjectId,
        score: 90,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.subject).toBe('Matem?ticas');
  });

  it('refuses a grade for a classroom the teacher does not own', async () => {
    const { otherEnrollment, teacherHeaders, subjectId } = await createSchool();

    const response = await client
      .post('/grades')
      .set(teacherHeaders)
      .send({
        enrollmentId: otherEnrollment.id,
        subjectId,
        score: 90,
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not assigned');
  });

  it('lets an admin record a grade for any classroom', async () => {
    const { otherEnrollment, adminHeaders, subjectId } = await createSchool();

    const response = await client
      .post('/grades')
      .set(adminHeaders)
      .send({
        enrollmentId: otherEnrollment.id,
        subjectId,
        score: 90,
      });

    expect(response.status).toBe(201);
  });

  it('lets a teacher record attendance for their own classroom', async () => {
    const { ownEnrollment, teacherHeaders, subjectId } = await createSchool();

    const response = await client
      .post('/attendance')
      .set(teacherHeaders)
      .send({
        enrollmentId: ownEnrollment.id,
        date: '2026-02-01',
        status: 'present',
      });

    expect(response.status).toBe(201);
  });

  it('refuses attendance for a classroom the teacher does not own', async () => {
    const { otherEnrollment, teacherHeaders, subjectId } = await createSchool();

    const response = await client
      .post('/attendance')
      .set(teacherHeaders)
      .send({
        enrollmentId: otherEnrollment.id,
        date: '2026-02-01',
        status: 'present',
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('not assigned');
  });

  it('refuses a teacher editing a grade of another classroom', async () => {
    const { institution, otherEnrollment, teacherHeaders, subjectId } =
      await createSchool();

    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const adminHeaders = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    const created = await client
      .post('/grades')
      .set(adminHeaders)
      .send({
        enrollmentId: otherEnrollment.id,
        subjectId,
        score: 90,
      });
    expect(created.status).toBe(201);

    const response = await client
      .patch(`/grades/${created.body.data.id}`)
      .set(teacherHeaders)
      .send({ score: 10 });

    expect(response.status).toBe(403);
  });

  it('refuses a teacher deleting attendance of another classroom', async () => {
    const { institution, otherEnrollment, teacherHeaders, subjectId } =
      await createSchool();

    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const adminHeaders = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    const created = await client
      .post('/attendance')
      .set(adminHeaders)
      .send({
        enrollmentId: otherEnrollment.id,
        date: '2026-02-01',
        status: 'present',
      });
    expect(created.status).toBe(201);

    const response = await client
      .delete(`/attendance/${created.body.data.id}`)
      .set(teacherHeaders);

    expect(response.status).toBe(403);
  });
});
