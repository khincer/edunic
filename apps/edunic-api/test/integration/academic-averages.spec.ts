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

const MISSING_ID = '99999999-9999-4999-8999-999999999999';

describe('academic averages routes', () => {
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

  it('computes annual and term averages without exposing the school', async () => {
    await createInstitutionFixture();
    const director = await createUserFixture({
      role: 'director',
    });
    const student = await createStudentFixture({});
    const termOne = await createAcademicPeriodFixture({
      term: 1,
    });
    const termTwo = await createAcademicPeriodFixture({
      term: 2,
    });
    const enrollmentOne = await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: termOne.id,
    });
    const enrollmentTwo = await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: termTwo.id,
    });
    await createGradeFixture({
      enrollmentId: enrollmentOne.id,
      score: 80,
    });
    await createGradeFixture({
      enrollmentId: enrollmentTwo.id,
      score: 100,
    });

    const response = await client
      .get(`/academic-averages/students/${student.id}?year=2026`)
      .set(
        await createAuthHeaders({
          userId: director.id,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty('institutionId');
    expect(response.body.data.studentId).toBe(student.id);
    expect(response.body.data.year).toBe(2026);
    expect(response.body.data.annualAverage).toBe(90);
    expect(response.body.data.termAverages.map((term: { term: number }) => term.term)).toEqual([1, 2]);
  });

  it('returns 404 for an unknown student', async () => {
    await createInstitutionFixture();
    const director = await createUserFixture({
      role: 'director',
    });

    const response = await client
      .get(`/academic-averages/students/${MISSING_ID}?year=2026`)
      .set(
        await createAuthHeaders({
          userId: director.id,
        })
      );

    expect(response.status).toBe(404);
  });
});
