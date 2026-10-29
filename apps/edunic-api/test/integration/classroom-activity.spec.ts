import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { assignments, schoolEvents } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createAttendanceFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createGradeFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

const OLD = new Date('2026-01-01T09:00:00.000Z');
const SINCE = '2026-01-10';

// ROLE-03 / ROLE-04: the administration sees the activity of every classroom
// (GET /classrooms/activity, one summary row per classroom) and of any one
// classroom (GET /classrooms/:id/activity); a teacher sees the activity of
// their own classrooms only. Activity is what was recorded since a date:
// grades, attendance marks, assignments and classroom events.
describe('classroom activity', () => {
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

  async function setCreatedAt(table: 'grades' | 'attendance', id: string, at: Date) {
    await db.execute(
      sql`update ${sql.raw(table)} set created_at = ${at} where id = ${id}`
    );
  }

  async function createSchool() {
    const busy = await createClassroomFixture({ gradeLevel: 5, section: 'A' });
    const quiet = await createClassroomFixture({ gradeLevel: 6, section: 'B' });
    const period = await createAcademicPeriodFixture({});

    const jane = await createStudentFixture({ firstName: 'Jane', firstLastName: 'Doe' });
    const john = await createStudentFixture({ firstName: 'John', firstLastName: 'Roe' });
    const quietStudent = await createStudentFixture({
      firstName: 'Quiet',
      firstLastName: 'Kid',
    });
    const janeEnrollment = await createEnrollmentFixture({
      studentId: jane.id,
      academicPeriodId: period.id,
      classroomId: busy.id,
    });
    const johnEnrollment = await createEnrollmentFixture({
      studentId: john.id,
      academicPeriodId: period.id,
      classroomId: busy.id,
      status: 'withdrawn',
    });
    await createEnrollmentFixture({
      studentId: quietStudent.id,
      academicPeriodId: period.id,
      classroomId: quiet.id,
    });

    // In the window: two grades, two attendance marks (one absence), one
    // assignment and one classroom event. Before it: one of each kind.
    const recentGrade = await createGradeFixture({
      enrollmentId: janeEnrollment.id,
      subject: 'Mathematics',
      score: 90,
    });
    await setCreatedAt('grades', recentGrade.id, new Date('2026-02-03T10:00:00.000Z'));
    const otherGrade = await createGradeFixture({
      enrollmentId: johnEnrollment.id,
      subject: 'History',
      score: 70,
    });
    await setCreatedAt('grades', otherGrade.id, new Date('2026-02-01T10:00:00.000Z'));
    const oldGrade = await createGradeFixture({
      enrollmentId: janeEnrollment.id,
      score: 50,
    });
    await setCreatedAt('grades', oldGrade.id, OLD);

    const absence = await createAttendanceFixture({
      enrollmentId: janeEnrollment.id,
      date: new Date('2026-02-02T08:00:00.000Z'),
      status: 'absent',
    });
    await setCreatedAt('attendance', absence.id, new Date('2026-02-02T08:30:00.000Z'));
    const present = await createAttendanceFixture({
      enrollmentId: johnEnrollment.id,
      date: new Date('2026-02-02T08:00:00.000Z'),
      status: 'present',
    });
    await setCreatedAt('attendance', present.id, new Date('2026-02-02T08:31:00.000Z'));
    const oldMark = await createAttendanceFixture({
      enrollmentId: janeEnrollment.id,
      date: new Date('2025-12-15T08:00:00.000Z'),
      status: 'late',
    });
    await setCreatedAt('attendance', oldMark.id, OLD);

    await db.insert(assignments).values([
      {
        classroomId: busy.id,
        title: 'Fractions worksheet',
        type: 'assignment',
        status: 'published',
        createdAt: new Date('2026-02-04T12:00:00.000Z'),
      },
      {
        classroomId: busy.id,
        title: 'Old homework',
        type: 'assignment',
        status: 'published',
        createdAt: OLD,
      },
      {
        classroomId: null,
        title: 'School-wide survey',
        type: 'assignment',
        status: 'published',
        createdAt: new Date('2026-02-04T12:00:00.000Z'),
      },
    ]);
    await db.insert(schoolEvents).values([
      {
        classroomId: busy.id,
        title: "Jane's birthday",
        eventType: 'classroom',
        startsAt: new Date('2026-02-10T00:00:00.000Z'),
        createdAt: new Date('2026-02-05T12:00:00.000Z'),
      },
      {
        classroomId: null,
        title: 'Science fair',
        eventType: 'school',
        startsAt: new Date('2026-03-10T00:00:00.000Z'),
        createdAt: new Date('2026-02-05T12:00:00.000Z'),
      },
    ]);

    const teacher = await createUserFixture({ role: 'teacher' });
    const coTeacher = await createUserFixture({ role: 'teacher' });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: busy.id,
    });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: coTeacher.id,
      classroomId: busy.id,
    });
    const director = await createUserFixture({ role: 'director' });
    const parent = await createUserFixture({ role: 'parent' });

    return {
      busy,
      quiet,
      jane,
      teacherHeaders: await createAuthHeaders({ userId: teacher.id }),
      directorHeaders: await createAuthHeaders({ userId: director.id }),
      parentHeaders: await createAuthHeaders({ userId: parent.id }),
    };
  }

  describe('GET /classrooms/:classroomId/activity', () => {
    const path = (classroomId: string, query = `since=${SINCE}`) =>
      `/classrooms/${classroomId}/activity?${query}`;

    it('summarises and lists what was recorded in the classroom since the date', async () => {
      const school = await createSchool();

      const response = await client
        .get(path(school.busy.id))
        .set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.classroom).toEqual({
        id: school.busy.id,
        gradeLevel: 5,
        section: 'A',
      });
      expect(response.body.data.since).toBe('2026-01-10T00:00:00.000Z');
      expect(response.body.data.totals).toEqual({
        activeStudents: 1,
        gradesRecorded: 2,
        gradeAverage: 80,
        attendanceMarked: 2,
        absences: 1,
        lates: 0,
        assignmentsCreated: 1,
        eventsScheduled: 1,
      });
      expect(
        response.body.data.recent.map(
          (item: { type: string; summary: string; studentName: string | null }) => [
            item.type,
            item.summary,
            item.studentName,
          ]
        )
      ).toEqual([
        ['event', "Jane's birthday", null],
        ['assignment', 'Fractions worksheet', null],
        ['grade', 'Mathematics: 90', 'Jane Doe'],
        ['attendance', 'present', 'John Roe'],
        ['attendance', 'absent', 'Jane Doe'],
        ['grade', 'History: 70', 'John Roe'],
      ]);
      expect(response.body.data.recent[2]).toEqual({
        type: 'grade',
        id: expect.any(String),
        // Raw `timestamp` text, like every other timestamp the API returns.
        occurredAt: '2026-02-03 10:00:00',
        studentId: school.jane.id,
        studentName: 'Jane Doe',
        summary: 'Mathematics: 90',
      });
    });

    it('caps the recent list with limit', async () => {
      const school = await createSchool();

      const response = await client
        .get(path(school.busy.id, `since=${SINCE}&limit=2`))
        .set(school.directorHeaders);

      expect(response.body.data.recent.map((item: { type: string }) => item.type))
        .toEqual(['event', 'assignment']);
      expect(response.body.data.totals.gradesRecorded).toBe(2);
    });

    it('defaults the window to the last 30 days', async () => {
      const school = await createSchool();

      const response = await client
        .get(`/classrooms/${school.busy.id}/activity`)
        .set(school.directorHeaders);

      expect(response.status).toBe(200);
      const since = new Date(response.body.data.since).getTime();
      const expected = Date.now() - 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(since - expected)).toBeLessThan(60_000);
    });

    it('lets a teacher read their own classroom', async () => {
      const school = await createSchool();

      const response = await client
        .get(path(school.busy.id))
        .set(school.teacherHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data.totals.gradesRecorded).toBe(2);
    });

    it("refuses a teacher another teacher's classroom and a parent any classroom", async () => {
      const school = await createSchool();

      const teacher = await client
        .get(path(school.quiet.id))
        .set(school.teacherHeaders);
      expect(teacher.status).toBe(403);

      const parent = await client
        .get(path(school.busy.id))
        .set(school.parentHeaders);
      expect(parent.status).toBe(403);
    });

    it('answers 404 for a missing classroom and 400 for a bad query', async () => {
      const school = await createSchool();

      const missing = await client
        .get(path('99999999-9999-4999-8999-999999999999'))
        .set(school.directorHeaders);
      expect(missing.status).toBe(404);

      const badDate = await client
        .get(path(school.busy.id, 'since=yesterday'))
        .set(school.directorHeaders);
      expect(badDate.status).toBe(400);

      const badLimit = await client
        .get(path(school.busy.id, 'limit=500'))
        .set(school.directorHeaders);
      expect(badLimit.status).toBe(400);
    });

    it('refuses a teacher a missing classroom without revealing it (403)', async () => {
      const school = await createSchool();

      const response = await client
        .get(path('99999999-9999-4999-8999-999999999999'))
        .set(school.teacherHeaders);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /classrooms/activity', () => {
    it('gives the administration one summary row per classroom', async () => {
      const school = await createSchool();

      const response = await client
        .get(`/classrooms/activity?since=${SINCE}`)
        .set(school.directorHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        since: '2026-01-10T00:00:00.000Z',
        classrooms: [
          {
            classroomId: school.busy.id,
            gradeLevel: 5,
            section: 'A',
            teacherCount: 2,
            activeStudents: 1,
            gradesRecorded: 2,
            attendanceMarked: 2,
            absences: 1,
            assignmentsCreated: 1,
            eventsScheduled: 1,
            lastActivityAt: '2026-02-05 12:00:00',
          },
          {
            classroomId: school.quiet.id,
            gradeLevel: 6,
            section: 'B',
            teacherCount: 0,
            activeStudents: 1,
            gradesRecorded: 0,
            attendanceMarked: 0,
            absences: 0,
            assignmentsCreated: 0,
            eventsScheduled: 0,
            lastActivityAt: null,
          },
        ],
      });
    });

    it('refuses teachers and parents (403) and anonymous callers (401)', async () => {
      const school = await createSchool();

      const teacher = await client
        .get('/classrooms/activity')
        .set(school.teacherHeaders);
      expect(teacher.status).toBe(403);

      const parent = await client
        .get('/classrooms/activity')
        .set(school.parentHeaders);
      expect(parent.status).toBe(403);

      const anonymous = await client.get('/classrooms/activity');
      expect(anonymous.status).toBe(401);
    });
  });
});
