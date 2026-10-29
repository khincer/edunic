import { db } from '@edunic/source/db';
import {
  assignments,
  guardianUserLinks,
  schoolEvents,
  studentGuardians,
} from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createAttendanceFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createGradeFixture,
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// Dashboards (ROLE-03, ROLE-04, PAR-01..04): the admin sees the whole school,
// a teacher only their own classrooms, a parent only their own children. None
// of the payloads names a school (AUTH-05).
describe('dashboards scoping', () => {
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

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // One school with two classrooms ("mine" and "other"), one child in each.
  // The teacher teaches "mine" and the parent has the child enrolled there.
  async function createSchool() {
    const institution = await createInstitutionFixture();
    const mine = await createClassroomFixture({
      gradeLevel: 5,
      section: 'A',
    });
    const other = await createClassroomFixture({
      gradeLevel: 6,
      section: 'B',
    });
    const period = await createAcademicPeriodFixture({});
    const myStudent = await createStudentFixture({
      firstName: 'Jane',
      firstLastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      firstName: 'John',
      firstLastName: 'Roe',
    });
    const myEnrollment = await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: period.id,
      classroomId: mine.id,
    });
    const otherEnrollment = await createEnrollmentFixture({
      studentId: otherStudent.id,
      academicPeriodId: period.id,
      classroomId: other.id,
    });
    await createGradeFixture({
      enrollmentId: myEnrollment.id,
      score: 50,
    });
    await createGradeFixture({
      enrollmentId: otherEnrollment.id,
      score: 40,
    });
    await createAttendanceFixture({
      enrollmentId: myEnrollment.id,
      status: 'absent',
    });
    await createAttendanceFixture({
      enrollmentId: otherEnrollment.id,
      status: 'absent',
    });

    for (const [title, classroomId] of [
      ['In mine', mine.id],
      ['In other', other.id],
    ] as const) {
      await db.insert(assignments).values({
        classroomId,
        title,
        type: 'exam',
        status: 'published',
        dueDate: future,
      });
      await db.insert(schoolEvents).values({
        classroomId,
        title: `Event ${title}`,
        eventType: 'classroom',
        startsAt: future,
      });
    }
    await db.insert(schoolEvents).values({
      title: 'Event school-wide',
      eventType: 'school',
      startsAt: future,
    });

    const guardian = await createGuardianFixture({});
    await db
      .insert(studentGuardians)
      .values({ studentId: myStudent.id, guardianId: guardian.id });
    const parent = await createUserFixture({
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      guardianId: guardian.id,
      userId: parent.id,
    });
    const strayParent = await createUserFixture({
      role: 'parent',
    });
    const teacher = await createUserFixture({
      role: 'teacher',
    });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: mine.id,
    });
    const idleTeacher = await createUserFixture({
      role: 'teacher',
    });
    const admin = await createUserFixture({
      role: 'director',
    });

    const headersFor = (userId: string) =>
      createAuthHeaders({ userId });

    return {
      myStudent,
      otherStudent,
      parentHeaders: await headersFor(parent.id),
      strayHeaders: await headersFor(strayParent.id),
      teacherHeaders: await headersFor(teacher.id),
      idleTeacherHeaders: await headersFor(idleTeacher.id),
      adminHeaders: await headersFor(admin.id),
    };
  }

  const titles = (rows: { title: string }[]) => rows.map((row) => row.title).sort();

  describe('admin', () => {
    it('shows the whole school and no school id', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/admin')
        .set(school.adminHeaders);

      expect(response.status).toBe(200);
      const { data } = response.body;
      expect(data.institution.name).toBe('Test Institution');
      expect(data.counts).toMatchObject({
        students: 2,
        teachers: 2,
        parents: 2,
        guardians: 1,
        activeEnrollments: 2,
        classrooms: 2,
      });
      expect(data.attendanceToday).toMatchObject({ marked: 0 });
      expect(data.gradeSubmission).toMatchObject({ submitted: 2, total: 2 });
      expect(titles(data.upcomingAssignments)).toEqual(['In mine', 'In other']);
      expect(titles(data.upcomingEvents)).toEqual([
        'Event In mine',
        'Event In other',
        'Event school-wide',
      ]);
      expect(data.reportHistory).toEqual([]);
      expect(JSON.stringify(data)).not.toContain('institutionId');
    });

    it('rejects teachers and parents', async () => {
      const school = await createSchool();

      const teacher = await client
        .get('/dashboard/admin')
        .set(school.teacherHeaders);
      const parent = await client
        .get('/dashboard/admin')
        .set(school.parentHeaders);

      expect(teacher.status).toBe(403);
      expect(parent.status).toBe(403);
    });
  });

  describe('teacher', () => {
    it('shows only the classrooms assigned to the teacher (ROLE-03)', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/teacher')
        .set(school.teacherHeaders);

      expect(response.status).toBe(200);
      const { data } = response.body;
      expect(data.classrooms.map((c: { name: string }) => c.name)).toEqual([
        'Grade 5 A',
      ]);
      expect(data.classrooms[0].rosterCount).toBe(1);
      expect(data.activeEnrollmentCount).toBe(1);
      expect(
        data.recentGrades.map((g: { studentId: string }) => g.studentId)
      ).toEqual([school.myStudent.id]);
      expect(
        data.studentsAtRisk.map((s: { studentId: string }) => s.studentId)
      ).toEqual([school.myStudent.id]);
      expect(titles(data.upcomingAssignments)).toEqual(['In mine']);
      expect(titles(data.upcomingEvents)).toEqual([
        'Event In mine',
        'Event school-wide',
      ]);
      expect(JSON.stringify(data)).not.toContain('institutionId');
    });

    it('shows a teacher without classrooms nothing of the others', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/teacher')
        .set(school.idleTeacherHeaders);

      expect(response.status).toBe(200);
      const { data } = response.body;
      expect(data.classrooms).toEqual([]);
      expect(data.activeEnrollmentCount).toBe(0);
      expect(data.recentGrades).toEqual([]);
      expect(data.studentsAtRisk).toEqual([]);
      expect(data.upcomingAssignments).toEqual([]);
      expect(titles(data.upcomingEvents)).toEqual(['Event school-wide']);
    });

    it('shows the admin every classroom', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/teacher')
        .set(school.adminHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.classrooms).toHaveLength(2);
      expect(response.body.data.activeEnrollmentCount).toBe(2);
      expect(response.body.data.recentGrades).toHaveLength(2);
    });

    it('rejects parents', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/teacher')
        .set(school.parentHeaders);

      expect(response.status).toBe(403);
    });
  });

  describe('parent', () => {
    it('shows only the own child and its classroom (PAR-01..04)', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/parent')
        .set(school.parentHeaders);

      expect(response.status).toBe(200);
      const { data } = response.body;
      expect(
        data.students.map((s: { studentId: string }) => s.studentId)
      ).toEqual([school.myStudent.id]);
      expect(data.students[0].classroomName).toBe('Grade 5 A');
      expect(data.students[0].average.gradeCount).toBe(1);
      expect(data.students[0].attendance.absent).toBe(1);
      expect(
        data.students[0].recentGrades.map((g: { score: number }) => g.score)
      ).toEqual([50]);
      expect(titles(data.upcomingAssignments)).toEqual(['In mine']);
      expect(titles(data.upcomingEvents)).toEqual([
        'Event In mine',
        'Event school-wide',
      ]);
      expect(JSON.stringify(data)).not.toContain('institutionId');
    });

    it('shows a parent without children nothing of other families', async () => {
      const school = await createSchool();

      const response = await client
        .get('/dashboard/parent')
        .set(school.strayHeaders);

      expect(response.status).toBe(200);
      const { data } = response.body;
      expect(data.students).toEqual([]);
      expect(data.payments).toEqual([]);
      expect(data.balances).toEqual([]);
      expect(data.upcomingAssignments).toEqual([]);
      expect(titles(data.upcomingEvents)).toEqual(['Event school-wide']);
    });

    it('rejects teachers and admins', async () => {
      const school = await createSchool();

      const teacher = await client
        .get('/dashboard/parent')
        .set(school.teacherHeaders);
      const admin = await client
        .get('/dashboard/parent')
        .set(school.adminHeaders);

      expect(teacher.status).toBe(403);
      expect(admin.status).toBe(403);
    });
  });
});
