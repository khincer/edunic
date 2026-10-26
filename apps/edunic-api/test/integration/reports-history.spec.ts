import { db } from '@edunic/source/db';
import {
  guardianUserLinks,
  reportHistory,
  studentGuardians,
} from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createGuardianFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// REP-03: every export of a report leaves a report_history row (who exported
// which student's report, for which year, when), and GET /reports/history
// lists them: the administration sees every export, a teacher the exports of
// the students in their classrooms. Parents do not read the history.
describe('report history', () => {
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

  // Two classrooms, one student in each. The parent is linked to the first
  // student and the teacher teaches the first classroom only.
  async function createSchool() {
    const myClassroom = await createClassroomFixture({});
    const otherClassroom = await createClassroomFixture({ section: 'B' });
    const period = await createAcademicPeriodFixture({});

    const myStudent = await createStudentFixture({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      firstName: 'John',
      lastName: 'Roe',
    });
    await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: period.id,
      classroomId: myClassroom.id,
    });
    await createEnrollmentFixture({
      studentId: otherStudent.id,
      academicPeriodId: period.id,
      classroomId: otherClassroom.id,
    });

    const guardian = await createGuardianFixture({});
    await db
      .insert(studentGuardians)
      .values({ studentId: myStudent.id, guardianId: guardian.id });
    const parent = await createUserFixture({ role: 'parent' });
    await db
      .insert(guardianUserLinks)
      .values({ guardianId: guardian.id, userId: parent.id });

    const teacher = await createUserFixture({ role: 'teacher' });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: myClassroom.id,
    });

    const director = await createUserFixture({ role: 'director' });

    return {
      myStudent,
      otherStudent,
      parent,
      teacher,
      director,
      parentHeaders: await createAuthHeaders({ userId: parent.id }),
      teacherHeaders: await createAuthHeaders({ userId: teacher.id }),
      directorHeaders: await createAuthHeaders({ userId: director.id }),
    };
  }

  const pdfPath = (studentId: string, year = 2026) =>
    `/reports/students/${studentId}/academic-summary/pdf?year=${year}`;

  async function storedHistory() {
    return db.select().from(reportHistory);
  }

  describe('recording exports', () => {
    it('records a PDF export with the student, the year and who exported it', async () => {
      const school = await createSchool();

      const response = await client
        .get(pdfPath(school.myStudent.id))
        .set(school.directorHeaders);

      expect(response.status).toBe(200);
      const rows = await storedHistory();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        studentId: school.myStudent.id,
        year: 2026,
        reportType: 'academic_summary_pdf',
        createdByUserId: school.director.id,
      });
    });

    it("records a parent's export of their own child", async () => {
      const school = await createSchool();

      const response = await client
        .get(pdfPath(school.myStudent.id, 2025))
        .set(school.parentHeaders);

      expect(response.status).toBe(200);
      const rows = await storedHistory();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        studentId: school.myStudent.id,
        year: 2025,
        createdByUserId: school.parent.id,
      });
    });

    it('records nothing for a refused export', async () => {
      const school = await createSchool();

      const response = await client
        .get(pdfPath(school.otherStudent.id))
        .set(school.teacherHeaders);

      expect(response.status).toBe(403);
      expect(await storedHistory()).toHaveLength(0);
    });

    it('records nothing for an export of a missing student', async () => {
      const school = await createSchool();

      const response = await client
        .get(pdfPath('99999999-9999-4999-8999-999999999999'))
        .set(school.directorHeaders);

      expect(response.status).toBe(404);
      expect(await storedHistory()).toHaveLength(0);
    });

    it('records nothing when the summary is only viewed, not exported', async () => {
      const school = await createSchool();

      const response = await client
        .get(`/reports/students/${school.myStudent.id}/academic-summary?year=2026`)
        .set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(await storedHistory()).toHaveLength(0);
    });
  });

  describe('GET /reports/history', () => {
    async function exportBoth(school: Awaited<ReturnType<typeof createSchool>>) {
      await client
        .get(pdfPath(school.myStudent.id))
        .set(school.directorHeaders)
        .expect(200);
      await client
        .get(pdfPath(school.otherStudent.id))
        .set(school.directorHeaders)
        .expect(200);
      await client
        .get(pdfPath(school.myStudent.id, 2025))
        .set(school.parentHeaders)
        .expect(200);
    }

    it('lists every export, newest first, to the administration', async () => {
      const school = await createSchool();
      await exportBoth(school);

      const response = await client
        .get('/reports/history')
        .set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toEqual({
        id: expect.any(String),
        studentId: school.myStudent.id,
        studentName: 'Jane Doe',
        year: 2025,
        reportType: 'academic_summary_pdf',
        createdByUserId: school.parent.id,
        createdAt: expect.any(String),
      });
      const createdAt = response.body.data.map(
        (row: { createdAt: string }) => row.createdAt
      );
      expect([...createdAt].sort().reverse()).toEqual(createdAt);
      expect(response.body.meta).toMatchObject({ total: 3 });
    });

    it("lists only the exports of a teacher's own students", async () => {
      const school = await createSchool();
      await exportBoth(school);

      const response = await client
        .get('/reports/history')
        .set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(
        response.body.data.every(
          (row: { studentId: string }) => row.studentId === school.myStudent.id
        )
      ).toBe(true);
      expect(response.body.meta).toMatchObject({ total: 2 });
    });

    it('lists nothing to a teacher without classrooms', async () => {
      const school = await createSchool();
      await exportBoth(school);
      const lonely = await createUserFixture({ role: 'teacher' });

      const response = await client
        .get('/reports/history')
        .set(await createAuthHeaders({ userId: lonely.id }));

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('filters by student and year', async () => {
      const school = await createSchool();
      await exportBoth(school);

      const byStudent = await client
        .get(`/reports/history?studentId=${school.myStudent.id}`)
        .set(school.directorHeaders);
      expect(byStudent.body.data).toHaveLength(2);

      const byYear = await client
        .get(`/reports/history?studentId=${school.myStudent.id}&year=2025`)
        .set(school.directorHeaders);
      expect(byYear.body.data).toHaveLength(1);
      expect(byYear.body.data[0].year).toBe(2025);
    });

    it('pages with limit/offset and with a cursor', async () => {
      const school = await createSchool();
      await exportBoth(school);

      const firstPage = await client
        .get('/reports/history?limit=2')
        .set(school.directorHeaders);
      expect(firstPage.body.data).toHaveLength(2);
      expect(firstPage.body.hasMore).toBe(true);

      const secondPage = await client
        .get('/reports/history?limit=2&offset=2')
        .set(school.directorHeaders);
      expect(secondPage.body.data).toHaveLength(1);
      expect(secondPage.body.hasMore).toBe(false);

      const cursorStart = await client
        .get('/reports/history?limit=2&cursor=start')
        .set(school.directorHeaders);
      expect(cursorStart.body.data).toHaveLength(2);
      const next = await client
        .get(
          `/reports/history?limit=2&cursor=${encodeURIComponent(
            cursorStart.body.nextCursor
          )}`
        )
        .set(school.directorHeaders);
      expect(next.body.data).toHaveLength(1);
      const ids = [...cursorStart.body.data, ...next.body.data].map(
        (row: { id: string }) => row.id
      );
      expect(new Set(ids).size).toBe(3);
    });

    it('rejects an invalid filter with 400', async () => {
      const school = await createSchool();

      const response = await client
        .get('/reports/history?studentId=not-a-uuid')
        .set(school.directorHeaders);

      expect(response.status).toBe(400);
    });

    it('refuses parents (403) and anonymous callers (401)', async () => {
      const school = await createSchool();

      const parent = await client
        .get('/reports/history')
        .set(school.parentHeaders);
      expect(parent.status).toBe(403);

      const anonymous = await client.get('/reports/history');
      expect(anonymous.status).toBe(401);
    });
  });
});
