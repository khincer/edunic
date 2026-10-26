import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createGradeFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// The academic summary reads one school's data without naming the school; the
// ownership rules live in reports-ownership.spec.ts.
describe('student academic summary content', () => {
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

  async function createGradedStudent() {
    await createInstitutionFixture();
    const period = await createAcademicPeriodFixture({});
    const student = await createStudentFixture({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const enrollment = await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: period.id,
    });
    await createGradeFixture({
      enrollmentId: enrollment.id,
      subject: 'Science',
      score: 80,
    });
    await createGradeFixture({
      enrollmentId: enrollment.id,
      subject: 'Science',
      score: 100,
    });
    const director = await createUserFixture({
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: director.id,
    });

    return { student, headers };
  }

  it('returns the summary without a school field and keeps the materia name', async () => {
    const { student, headers } = await createGradedStudent();

    const response = await client
      .get(`/reports/students/${student.id}/academic-summary?year=2026`)
      .set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty('institutionId');
    expect(response.body.data.student.fullName).toBe('Jane Doe');
    expect(response.body.data.annualAverage).toBe(90);
    expect(response.body.data.annualSubjects).toEqual([
      { subject: 'Science', average: 90 },
    ]);
    expect(response.body.data.enrollments).toHaveLength(1);
  });

  it('renders the PDF and answers 404 for an unknown student', async () => {
    const { student, headers } = await createGradedStudent();

    const pdf = await client
      .get(`/reports/students/${student.id}/academic-summary/pdf?year=2026`)
      .set(headers);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    const missing = await client
      .get(
        '/reports/students/99999999-9999-4999-8999-999999999999/academic-summary?year=2026'
      )
      .set(headers);
    expect(missing.status).toBe(404);
  });
});
