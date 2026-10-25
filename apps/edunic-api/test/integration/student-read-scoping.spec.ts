import { db } from '@edunic/source/db';
import { guardianUserLinks, studentGuardians } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// Reading a student's record, their guardians, enrollments and averages is
// private to the staff who teach them and to their own family (PAR-04,
// ROLE-04, REP-01). One school, two families, two classrooms: the parent is
// linked to "mine" and the teacher teaches the "mine" classroom only.
describe('per-student read scoping', () => {
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
    const institution = await createInstitutionFixture();
    const myClassroom = await createClassroomFixture({
      institutionId: institution.id,
    });
    const otherClassroom = await createClassroomFixture({
      institutionId: institution.id,
      section: 'B',
    });
    const period = await createAcademicPeriodFixture({
      institutionId: institution.id,
    });

    const myStudent = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'John',
      lastName: 'Roe',
    });
    const myEnrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: myStudent.id,
      academicPeriodId: period.id,
      classroomId: myClassroom.id,
    });
    const otherEnrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: otherStudent.id,
      academicPeriodId: period.id,
      classroomId: otherClassroom.id,
    });

    const myGuardian = await createGuardianFixture({
      institutionId: institution.id,
      name: 'Ana Doe',
    });
    const otherGuardian = await createGuardianFixture({
      institutionId: institution.id,
      name: 'Rosa Roe',
    });
    const unlinkedGuardian = await createGuardianFixture({
      institutionId: institution.id,
      name: 'Nadie Linked',
    });
    await db.insert(studentGuardians).values([
      { studentId: myStudent.id, guardianId: myGuardian.id },
      { studentId: otherStudent.id, guardianId: otherGuardian.id },
    ]);

    const parent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      institutionId: institution.id,
      guardianId: myGuardian.id,
      userId: parent.id,
    });
    // A parent account that is not linked to any guardian sees nothing.
    const strayParent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });

    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    await createTeacherClassroomAssignmentFixture({
      institutionId: institution.id,
      teacherUserId: teacher.id,
      classroomId: myClassroom.id,
    });

    const director = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });

    const headersFor = (userId: string) =>
      createAuthHeaders({ userId, institutionId: institution.id });

    return {
      institutionId: institution.id,
      myStudent,
      otherStudent,
      myEnrollment,
      otherEnrollment,
      myGuardian,
      otherGuardian,
      unlinkedGuardian,
      parentHeaders: await headersFor(parent.id),
      strayParentHeaders: await headersFor(strayParent.id),
      teacherHeaders: await headersFor(teacher.id),
      directorHeaders: await headersFor(director.id),
    };
  }

  const ids = (body: { data: Array<{ id: string }> }) =>
    body.data.map((row) => row.id).sort();

  describe('GET /students/:studentId', () => {
    it('lets a parent read their own child and refuses another family', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/students/${school.myStudent.id}`)
        .set(school.parentHeaders);
      const other = await client
        .get(`/students/${school.otherStudent.id}`)
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(mine.body.data.id).toBe(school.myStudent.id);
      expect(other.status).toBe(403);
    });

    it('lets a teacher read a student of their classroom and refuses others', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/students/${school.myStudent.id}`)
        .set(school.teacherHeaders);
      const other = await client
        .get(`/students/${school.otherStudent.id}`)
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
    });

    it('lets the administration read any student', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/students/${school.myStudent.id}`)
        .set(school.directorHeaders);
      const other = await client
        .get(`/students/${school.otherStudent.id}`)
        .set(school.directorHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(200);
    });

    it('does not reveal whether a student exists to a parent', async () => {
      const school = await createSchool();
      const missing = '00000000-0000-4000-8000-00000000dead';

      const parent = await client.get(`/students/${missing}`).set(school.parentHeaders);
      const director = await client
        .get(`/students/${missing}`)
        .set(school.directorHeaders);

      expect(parent.status).toBe(403);
      expect(director.status).toBe(404);
    });
  });

  describe('GET /students', () => {
    it('lists only the own children of a parent', async () => {
      const school = await createSchool();

      const response = await client.get('/students').set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myStudent.id]);
    });

    it('lists only the students of the classrooms of a teacher', async () => {
      const school = await createSchool();

      const response = await client.get('/students').set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myStudent.id]);
    });

    it('lists every student for the administration', async () => {
      const school = await createSchool();

      const response = await client.get('/students').set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [school.myStudent.id, school.otherStudent.id].sort()
      );
    });

    it('lists nothing for a parent account without linked children', async () => {
      const school = await createSchool();

      const response = await client.get('/students').set(school.strayParentHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('keeps search, total and pagination inside the scoped set', async () => {
      const school = await createSchool();

      const searchOther = await client
        .get('/students?search=John')
        .set(school.parentHeaders);
      const searchMine = await client
        .get('/students?search=Jane')
        .set(school.parentHeaders);
      const paged = await client
        .get('/students?limit=1')
        .set(school.teacherHeaders);

      expect(searchOther.body.data).toHaveLength(0);
      expect(ids(searchMine.body)).toEqual([school.myStudent.id]);
      expect(paged.body.meta.total).toBe(1);
      expect(paged.body.data).toHaveLength(1);
    });
  });

  describe('GET /students/:studentId/guardians', () => {
    it('lets a parent read the guardians of their own child only', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/students/${school.myStudent.id}/guardians`)
        .set(school.parentHeaders);
      const other = await client
        .get(`/students/${school.otherStudent.id}/guardians`)
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(ids(mine.body)).toEqual([school.myGuardian.id]);
      expect(other.status).toBe(403);
    });

    it('lets a teacher read the guardians of their own students only', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/students/${school.myStudent.id}/guardians`)
        .set(school.teacherHeaders);
      const other = await client
        .get(`/students/${school.otherStudent.id}/guardians`)
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(ids(mine.body)).toEqual([school.myGuardian.id]);
      expect(other.status).toBe(403);
    });

    it('lets the administration read the guardians of any student', async () => {
      const school = await createSchool();

      const other = await client
        .get(`/students/${school.otherStudent.id}/guardians`)
        .set(school.directorHeaders);

      expect(other.status).toBe(200);
      expect(ids(other.body)).toEqual([school.otherGuardian.id]);
    });
  });

  describe('GET /guardians/:guardianId', () => {
    it('lets a parent read themselves and refuses the guardians of another family', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/guardians/${school.myGuardian.id}`)
        .set(school.parentHeaders);
      const other = await client
        .get(`/guardians/${school.otherGuardian.id}`)
        .set(school.parentHeaders);
      const unlinked = await client
        .get(`/guardians/${school.unlinkedGuardian.id}`)
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
      expect(unlinked.status).toBe(403);
    });

    it('lets a parent read another guardian of their own child', async () => {
      const school = await createSchool();
      const coGuardian = await createGuardianFixture({
        institutionId: school.institutionId,
        name: 'Tio Doe',
      });
      await db.insert(studentGuardians).values({
        studentId: school.myStudent.id,
        guardianId: coGuardian.id,
      });

      const response = await client
        .get(`/guardians/${coGuardian.id}`)
        .set(school.parentHeaders);

      expect(response.status).toBe(200);
    });

    it('lets a teacher read the guardians of their students only', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/guardians/${school.myGuardian.id}`)
        .set(school.teacherHeaders);
      const other = await client
        .get(`/guardians/${school.otherGuardian.id}`)
        .set(school.teacherHeaders);
      const unlinked = await client
        .get(`/guardians/${school.unlinkedGuardian.id}`)
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
      expect(unlinked.status).toBe(403);
    });

    it('lets the administration read any guardian', async () => {
      const school = await createSchool();

      const other = await client
        .get(`/guardians/${school.otherGuardian.id}`)
        .set(school.directorHeaders);
      const unlinked = await client
        .get(`/guardians/${school.unlinkedGuardian.id}`)
        .set(school.directorHeaders);

      expect(other.status).toBe(200);
      expect(unlinked.status).toBe(200);
    });
  });

  describe('GET /guardians', () => {
    it('lists only the guardians of the own children of a parent', async () => {
      const school = await createSchool();

      const response = await client.get('/guardians').set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myGuardian.id]);
    });

    it('lists only the guardians of the students of a teacher', async () => {
      const school = await createSchool();

      const response = await client.get('/guardians').set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myGuardian.id]);
      expect(response.body.meta.total).toBe(1);
    });

    it('lists every guardian for the administration', async () => {
      const school = await createSchool();

      const response = await client.get('/guardians').set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [
          school.myGuardian.id,
          school.otherGuardian.id,
          school.unlinkedGuardian.id,
        ].sort()
      );
    });
  });

  describe('GET /enrollments/:enrollmentId', () => {
    it('lets a parent read the enrollment of their child only', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/enrollments/${school.myEnrollment.id}`)
        .set(school.parentHeaders);
      const other = await client
        .get(`/enrollments/${school.otherEnrollment.id}`)
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(mine.body.data.id).toBe(school.myEnrollment.id);
      expect(other.status).toBe(403);
    });

    it('lets a teacher read the enrollment of their students only', async () => {
      const school = await createSchool();

      const mine = await client
        .get(`/enrollments/${school.myEnrollment.id}`)
        .set(school.teacherHeaders);
      const other = await client
        .get(`/enrollments/${school.otherEnrollment.id}`)
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
    });

    it('lets the administration read any enrollment', async () => {
      const school = await createSchool();

      const other = await client
        .get(`/enrollments/${school.otherEnrollment.id}`)
        .set(school.directorHeaders);

      expect(other.status).toBe(200);
    });
  });

  describe('GET /enrollments', () => {
    it('lists only the enrollments of the own children of a parent', async () => {
      const school = await createSchool();

      const response = await client.get('/enrollments').set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myEnrollment.id]);
    });

    it('lists only the enrollments of the students of a teacher', async () => {
      const school = await createSchool();

      const response = await client.get('/enrollments').set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual([school.myEnrollment.id]);
    });

    it('lists every enrollment for the administration', async () => {
      const school = await createSchool();

      const response = await client.get('/enrollments').set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(ids(response.body)).toEqual(
        [school.myEnrollment.id, school.otherEnrollment.id].sort()
      );
    });

    it('does not let a parent widen the list with a studentId filter', async () => {
      const school = await createSchool();

      const response = await client
        .get(`/enrollments?studentId=${school.otherStudent.id}`)
        .set(school.parentHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.total).toBe(0);
    });
  });

  describe('GET /academic-averages/students/:studentId', () => {
    const path = (studentId: string) =>
      `/academic-averages/students/${studentId}?year=2026`;

    it('lets a parent read the averages of their child only', async () => {
      const school = await createSchool();

      const mine = await client.get(path(school.myStudent.id)).set(school.parentHeaders);
      const other = await client
        .get(path(school.otherStudent.id))
        .set(school.parentHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
    });

    it('lets a teacher read the averages of their students only', async () => {
      const school = await createSchool();

      const mine = await client
        .get(path(school.myStudent.id))
        .set(school.teacherHeaders);
      const other = await client
        .get(path(school.otherStudent.id))
        .set(school.teacherHeaders);

      expect(mine.status).toBe(200);
      expect(other.status).toBe(403);
    });

    it('lets the administration read the averages of any student', async () => {
      const school = await createSchool();

      const other = await client
        .get(path(school.otherStudent.id))
        .set(school.directorHeaders);

      expect(other.status).toBe(200);
    });
  });
});
