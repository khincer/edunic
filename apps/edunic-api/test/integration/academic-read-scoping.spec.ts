import { db } from '@edunic/source/db';
import { guardianUserLinks, studentGuardians } from '@edunic/source/db/schema';
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

// Reading grades and attendance is private to the staff who teach the
// student and to the student's own family (PAR-04, ROLE-04). One school, two
// families, two classrooms: the parent is linked to "mine" and the teacher
// teaches the "mine" classroom only.
describe('grade and attendance read scoping', () => {
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

  async function createSchool() {
    await createInstitutionFixture();
    const myClassroom = await createClassroomFixture({});
    const otherClassroom = await createClassroomFixture({
      section: 'B',
    });
    const period = await createAcademicPeriodFixture({});

    const myStudent = await createStudentFixture({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      firstName: 'John',
      lastName: 'Roe',
    });
    const myEnrollment = await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: period.id,
      classroomId: myClassroom.id,
    });
    const otherEnrollment = await createEnrollmentFixture({
      studentId: otherStudent.id,
      academicPeriodId: period.id,
      classroomId: otherClassroom.id,
    });

    const myGrade = await createGradeFixture({
      enrollmentId: myEnrollment.id,
      score: 91,
    });
    const myGradeTwo = await createGradeFixture({
      enrollmentId: myEnrollment.id,
      subject: 'Science',
      score: 85,
    });
    const otherGrade = await createGradeFixture({
      enrollmentId: otherEnrollment.id,
      score: 42,
    });
    const myAttendance = await createAttendanceFixture({
      enrollmentId: myEnrollment.id,
      status: 'present',
    });
    const otherAttendance = await createAttendanceFixture({
      enrollmentId: otherEnrollment.id,
      status: 'absent',
    });

    const myGuardian = await createGuardianFixture({
      name: 'Ana Doe',
    });
    const otherGuardian = await createGuardianFixture({
      name: 'Rosa Roe',
    });
    await db.insert(studentGuardians).values([
      { studentId: myStudent.id, guardianId: myGuardian.id },
      { studentId: otherStudent.id, guardianId: otherGuardian.id },
    ]);

    const parent = await createUserFixture({
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      guardianId: myGuardian.id,
      userId: parent.id,
    });
    // A parent account that is not linked to any guardian sees nothing.
    const strayParent = await createUserFixture({
      role: 'parent',
    });

    const teacher = await createUserFixture({
      role: 'teacher',
    });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: myClassroom.id,
    });

    const director = await createUserFixture({
      role: 'director',
    });

    const headersFor = (userId: string) =>
      createAuthHeaders({ userId });

    return {
      myGrade,
      myGradeTwo,
      otherGrade,
      myAttendance,
      otherAttendance,
      parentHeaders: await headersFor(parent.id),
      strayParentHeaders: await headersFor(strayParent.id),
      teacherHeaders: await headersFor(teacher.id),
      directorHeaders: await headersFor(director.id),
    };
  }

  const ids = (body: { data: Array<{ id: string }> }) =>
    body.data.map((row) => row.id).sort();
  const missing = '00000000-0000-4000-8000-00000000dead';

  describe('GET /grades/:gradeId', () => {
    it('lets a parent read the grade of their child and refuses another family', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/grades/${school.myGrade.id}`)
        .set(school.parentHeaders);
      const other = await client
        .get(`/grades/${school.otherGrade.id}`)
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(mine.body.data.id).toBe(school.myGrade.id);
      expect(other.status).toBe(403);
    });

    it('lets a teacher read the grade of a student of their classroom and refuses others', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/grades/${school.myGrade.id}`)
        .set(school.teacherHeaders);
      const other = await client
        .get(`/grades/${school.otherGrade.id}`)
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
    });

    it('lets the administration read any grade', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/grades/${school.myGrade.id}`)
        .set(school.directorHeaders);
      const other = await client
        .get(`/grades/${school.otherGrade.id}`)
        .set(school.directorHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(200);
    });

    it('refuses an unlinked parent and does not reveal whether a grade exists', async () => {
      const school = await createSchool();

      const stray = await client
        .get(`/grades/${school.myGrade.id}`)
        .set(school.strayParentHeaders);
      const parent = await client.get(`/grades/${missing}`).set(school.parentHeaders);
      const teacher = await client.get(`/grades/${missing}`).set(school.teacherHeaders);
      const director = await client
        .get(`/grades/${missing}`)
        .set(school.directorHeaders);

      expect(stray.status).toBe(403);
      expect(parent.status).toBe(403);
      expect(teacher.status).toBe(403);
      expect(director.status).toBe(404);
    });
  });

  describe('GET /grades', () => {
    it('lists only the grades of the own children of a parent', async () => {
      const school = await createSchool();

      const response = await client.get('/grades').set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [school.myGrade.id, school.myGradeTwo.id].sort()
      );
    });

    it('lists only the grades of the students of a teacher', async () => {
      const school = await createSchool();

      const response = await client.get('/grades').set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [school.myGrade.id, school.myGradeTwo.id].sort()
      );
    });

    it('lists every grade for the administration', async () => {
      const school = await createSchool();

      const response = await client.get('/grades').set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [school.myGrade.id, school.myGradeTwo.id, school.otherGrade.id].sort()
      );
    });

    it('lists nothing for a parent account without linked children', async () => {
      const school = await createSchool();

      const response = await client.get('/grades').set(school.strayParentHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('keeps total, pagination and filters inside the scoped set', async () => {
      const school = await createSchool();

      const paged = await client.get('/grades?limit=1').set(school.parentHeaders);
      const bySearch = await client
        .get('/grades?search=Science')
        .set(school.teacherHeaders);

      expect(paged.body.meta.total).toBe(2);
      expect(paged.body.data).toHaveLength(1);
      expect(ids(bySearch.body)).toEqual([school.myGradeTwo.id]);
    });

    it('does not let a parent widen the list with an enrollmentId filter', async () => {
      const school = await createSchool();

      const response = await client
        .get(`/grades?enrollmentId=${school.otherGrade.enrollmentId}`)
        .set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('GET /attendance/:attendanceId', () => {
    it('lets a parent read the attendance of their child and refuses another family', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/attendance/${school.myAttendance.id}`)
        .set(school.parentHeaders);
      const other = await client
        .get(`/attendance/${school.otherAttendance.id}`)
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(mine.body.data.id).toBe(school.myAttendance.id);
      expect(other.status).toBe(403);
    });

    it('lets a teacher read the attendance of a student of their classroom and refuses others', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/attendance/${school.myAttendance.id}`)
        .set(school.teacherHeaders);
      const other = await client
        .get(`/attendance/${school.otherAttendance.id}`)
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
    });

    it('lets the administration read any attendance record', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/attendance/${school.myAttendance.id}`)
        .set(school.directorHeaders);
      const other = await client
        .get(`/attendance/${school.otherAttendance.id}`)
        .set(school.directorHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(200);
    });

    it('refuses an unlinked parent and does not reveal whether a record exists', async () => {
      const school = await createSchool();

      const stray = await client
        .get(`/attendance/${school.myAttendance.id}`)
        .set(school.strayParentHeaders);
      const parent = await client
        .get(`/attendance/${missing}`)
        .set(school.parentHeaders);
      const teacher = await client
        .get(`/attendance/${missing}`)
        .set(school.teacherHeaders);
      const director = await client
        .get(`/attendance/${missing}`)
        .set(school.directorHeaders);

      expect(stray.status).toBe(403);
      expect(parent.status).toBe(403);
      expect(teacher.status).toBe(403);
      expect(director.status).toBe(404);
    });
  });

  describe('GET /attendance', () => {
    it('lists only the attendance of the own children of a parent', async () => {
      const school = await createSchool();

      const response = await client.get('/attendance').set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myAttendance.id]);
    });

    it('lists only the attendance of the students of a teacher', async () => {
      const school = await createSchool();

      const response = await client.get('/attendance').set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myAttendance.id]);
    });

    it('lists every attendance record for the administration', async () => {
      const school = await createSchool();

      const response = await client.get('/attendance').set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [school.myAttendance.id, school.otherAttendance.id].sort()
      );
    });

    it('lists nothing for a parent account without linked children', async () => {
      const school = await createSchool();

      const response = await client
        .get('/attendance')
        .set(school.strayParentHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('keeps total and filters inside the scoped set', async () => {
      const school = await createSchool();

      const absent = await client
        .get('/attendance?status=absent')
        .set(school.parentHeaders);
      const all = await client.get('/attendance?limit=1').set(school.teacherHeaders);

      expect(absent.body.data).toHaveLength(0);
      expect(absent.body.meta.total).toBe(0);
      expect(all.body.meta.total).toBe(1);
      expect(all.body.data).toHaveLength(1);
    });
  });
});
