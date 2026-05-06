import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('grades routes', () => {
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

  it('supports CRUD for grades', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const headers = createAuthHeaders({
      userId: teacherUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/grades').set(headers).send({
      enrollmentId: enrollment.id,
      subject: 'Mathematics',
      score: 88,
    });

    expect(createResponse.status).toBe(201);
    const gradeId = createResponse.body.data.id;

    const updateResponse = await client
      .patch(`/grades/${gradeId}`)
      .set(headers)
      .send({ score: 91 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.score).toBe(91);

    const listResponse = await client.get('/grades').set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);

    const deleteResponse = await client
      .delete(`/grades/${gradeId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('returns 404 when enrollment is outside the institution', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const otherInstitution = await createInstitutionFixture('Other');
    const student = await createStudentFixture({ institutionId: otherInstitution.id });
    const period = await createAcademicPeriodFixture({ institutionId: otherInstitution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: otherInstitution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });

    const response = await client
      .post('/grades')
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        enrollmentId: enrollment.id,
        subject: 'Science',
        score: 95,
      });

    expect(response.status).toBe(404);
  });
});
