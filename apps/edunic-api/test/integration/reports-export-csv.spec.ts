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
  createGradeFixture,
  createGuardianFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

const HEADER =
  'student_id,student_name,grade_level,section,year,term,subject,score';

// REP-02: GET /reports/export.csv exports the grades of a year as CSV. The
// administration exports any student, a teacher the students of their
// classrooms, a parent their own children. Cells are RFC 4180 escaped and a
// cell that a spreadsheet would run as a formula is neutralised. Each exported
// student gets a report_history row (REP-03).
describe('GET /reports/export.csv', () => {
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
    const myClassroom = await createClassroomFixture({ gradeLevel: 5 });
    const otherClassroom = await createClassroomFixture({
      gradeLevel: 6,
      section: 'B',
    });
    const term1 = await createAcademicPeriodFixture({ year: 2026, term: 1 });
    const term2 = await createAcademicPeriodFixture({ year: 2026, term: 2 });
    const lastYear = await createAcademicPeriodFixture({ year: 2025, term: 4 });

    // The second name is a CSV injection payload with a comma and quotes.
    const myStudent = await createStudentFixture({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      firstName: '=HYPERLINK("http://evil","x")',
      lastName: 'Roe, Jr',
    });

    const myTerm1 = await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: term1.id,
      classroomId: myClassroom.id,
    });
    const myTerm2 = await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: term2.id,
      classroomId: myClassroom.id,
    });
    const myLastYear = await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: lastYear.id,
      classroomId: myClassroom.id,
    });
    const otherTerm1 = await createEnrollmentFixture({
      studentId: otherStudent.id,
      academicPeriodId: term1.id,
      classroomId: otherClassroom.id,
    });

    await createGradeFixture({
      enrollmentId: myTerm1.id,
      subject: 'Mathematics',
      score: 90,
    });
    await createGradeFixture({
      enrollmentId: myTerm2.id,
      subject: 'History',
      score: 75,
    });
    await createGradeFixture({ enrollmentId: myLastYear.id, score: 60 });
    await createGradeFixture({
      enrollmentId: otherTerm1.id,
      subject: 'Mathematics',
      score: 80,
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
      myClassroom,
      otherClassroom,
      director,
      parentHeaders: await createAuthHeaders({ userId: parent.id }),
      teacherHeaders: await createAuthHeaders({ userId: teacher.id }),
      directorHeaders: await createAuthHeaders({ userId: director.id }),
    };
  }

  function lines(text: string) {
    expect(text.endsWith('\r\n')).toBe(true);
    return text.slice(0, -2).split('\r\n');
  }

  it('exports every student of the year to the administration, escaped and formula-safe', async () => {
    const school = await createSchool();

    const response = await client
      .get('/reports/export.csv?year=2026')
      .set(school.directorHeaders)
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')));
        res.on('end', () => done(null, text));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="grades-2026.csv"'
    );
    expect(lines(response.body as string)).toEqual([
      HEADER,
      `${school.myStudent.id},Jane Doe,5,A,2026,1,Mathematics,90`,
      `${school.myStudent.id},Jane Doe,5,A,2026,2,History,75`,
      `${school.otherStudent.id},"'=HYPERLINK(""http://evil"",""x"") Roe, Jr",6,B,2026,1,Mathematics,80`,
    ]);
  });

  it("exports only a teacher's own classrooms", async () => {
    const school = await createSchool();

    const response = await client
      .get('/reports/export.csv?year=2026')
      .set(school.teacherHeaders);

    expect(response.status).toBe(200);
    const rows = lines(response.text);
    expect(rows).toHaveLength(3);
    expect(rows.slice(1).every((row) => row.startsWith(school.myStudent.id))).toBe(
      true
    );
  });

  it("refuses a teacher another teacher's classroom or student", async () => {
    const school = await createSchool();

    const classroom = await client
      .get(`/reports/export.csv?year=2026&classroomId=${school.otherClassroom.id}`)
      .set(school.teacherHeaders);
    expect(classroom.status).toBe(403);

    const student = await client
      .get(`/reports/export.csv?year=2026&studentId=${school.otherStudent.id}`)
      .set(school.teacherHeaders);
    expect(student.status).toBe(403);
  });

  it('exports only their own child to a parent and refuses another child', async () => {
    const school = await createSchool();

    const own = await client
      .get('/reports/export.csv?year=2026')
      .set(school.parentHeaders);
    expect(own.status).toBe(200);
    const rows = lines(own.text);
    expect(rows).toHaveLength(3);
    expect(rows.slice(1).every((row) => row.startsWith(school.myStudent.id))).toBe(
      true
    );

    const other = await client
      .get(`/reports/export.csv?year=2026&studentId=${school.otherStudent.id}`)
      .set(school.parentHeaders);
    expect(other.status).toBe(403);
  });

  it('narrows the export to one student or one classroom', async () => {
    const school = await createSchool();

    const byStudent = await client
      .get(`/reports/export.csv?year=2026&studentId=${school.otherStudent.id}`)
      .set(school.directorHeaders);
    expect(lines(byStudent.text)).toHaveLength(2);

    const byClassroom = await client
      .get(`/reports/export.csv?year=2026&classroomId=${school.myClassroom.id}`)
      .set(school.directorHeaders);
    expect(lines(byClassroom.text)).toHaveLength(3);

    const lastYear = await client
      .get(`/reports/export.csv?year=2025&studentId=${school.myStudent.id}`)
      .set(school.directorHeaders);
    expect(lines(lastYear.text)).toEqual([
      HEADER,
      `${school.myStudent.id},Jane Doe,5,A,2025,4,Mathematics,60`,
    ]);
  });

  it('answers a header-only CSV when nothing matches', async () => {
    const school = await createSchool();

    const response = await client
      .get('/reports/export.csv?year=2030')
      .set(school.directorHeaders);

    expect(response.status).toBe(200);
    expect(response.text).toBe(`${HEADER}\r\n`);
  });

  it('records one report_history row per exported student', async () => {
    const school = await createSchool();

    await client
      .get('/reports/export.csv?year=2026')
      .set(school.directorHeaders)
      .expect(200);

    const rows = await db.select().from(reportHistory);
    expect(
      rows
        .map((row) => ({
          studentId: row.studentId,
          year: row.year,
          reportType: row.reportType,
          createdByUserId: row.createdByUserId,
        }))
        .sort((a, b) => a.studentId.localeCompare(b.studentId))
    ).toEqual(
      [school.myStudent.id, school.otherStudent.id].sort().map((studentId) => ({
        studentId,
        year: 2026,
        reportType: 'grades_csv',
        createdByUserId: school.director.id,
      }))
    );
  });

  it('records nothing for a refused export', async () => {
    const school = await createSchool();

    await client
      .get(`/reports/export.csv?year=2026&studentId=${school.otherStudent.id}`)
      .set(school.parentHeaders)
      .expect(403);

    expect(await db.select().from(reportHistory)).toHaveLength(0);
  });

  it('validates the query (400) and requires a signed-in caller (401)', async () => {
    const school = await createSchool();

    const missingYear = await client
      .get('/reports/export.csv')
      .set(school.directorHeaders);
    expect(missingYear.status).toBe(400);

    const badStudent = await client
      .get('/reports/export.csv?year=2026&studentId=nope')
      .set(school.directorHeaders);
    expect(badStudent.status).toBe(400);

    const anonymous = await client.get('/reports/export.csv?year=2026');
    expect(anonymous.status).toBe(401);
  });
});
