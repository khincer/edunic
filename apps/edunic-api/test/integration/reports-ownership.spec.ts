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

// A student's academic summary (grades and attendance) is private to the
// school staff who teach them and to their own family (PAR-04, REP-01).
describe('student academic summary ownership', () => {
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
    await db.insert(studentGuardians).values({
      studentId: myStudent.id,
      guardianId: guardian.id,
    });
    const parent = await createUserFixture({
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      guardianId: guardian.id,
      userId: parent.id,
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
      myStudent,
      otherStudent,
      parentHeaders: await headersFor(parent.id),
      teacherHeaders: await headersFor(teacher.id),
      directorHeaders: await headersFor(director.id),
    };
  }

  const summaryPath = (studentId: string) =>
    `/reports/students/${studentId}/academic-summary?year=2026`;
  const pdfPath = (studentId: string) =>
    `/reports/students/${studentId}/academic-summary/pdf?year=2026`;

  it('lets a parent read the summary of their own child', async () => {
    const school = await createSchool();

    const response = await client
      .get(summaryPath(school.myStudent.id))
      .set(school.parentHeaders);

    expect(response.status).toBe(200);
  });

  it("refuses a parent the summary of another family's child", async () => {
    const school = await createSchool();

    const json = await client
      .get(summaryPath(school.otherStudent.id))
      .set(school.parentHeaders);
    const pdf = await client
      .get(pdfPath(school.otherStudent.id))
      .set(school.parentHeaders);

    expect(json.status).toBe(403);
    expect(pdf.status).toBe(403);
  });

  it('lets a teacher read the summary of a student in their classroom', async () => {
    const school = await createSchool();

    const response = await client
      .get(summaryPath(school.myStudent.id))
      .set(school.teacherHeaders);

    expect(response.status).toBe(200);
  });

  it('refuses a teacher the summary of a student outside their classrooms', async () => {
    const school = await createSchool();

    const json = await client
      .get(summaryPath(school.otherStudent.id))
      .set(school.teacherHeaders);
    const pdf = await client
      .get(pdfPath(school.otherStudent.id))
      .set(school.teacherHeaders);

    expect(json.status).toBe(403);
    expect(pdf.status).toBe(403);
  });

  it('lets the administration read any student summary', async () => {
    const school = await createSchool();

    const mine = await client
      .get(summaryPath(school.myStudent.id))
      .set(school.directorHeaders);
    const other = await client
      .get(summaryPath(school.otherStudent.id))
      .set(school.directorHeaders);

    expect(mine.status).toBe(200);
    expect(other.status).toBe(200);
  });
});
