import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createInstitutionFixture,
  createStudentFixture,
  createEnrollmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('academic periods routes', () => {
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

  it('supports CRUD and duplicate protection', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/academic-periods').set(headers).send({
      year: 2026,
      term: 1,
      startDate: '2026-01-15T00:00:00.000Z',
      endDate: '2026-03-31T00:00:00.000Z',
    });

    expect(createResponse.status).toBe(201);
    const periodId = createResponse.body.data.id;

    const duplicateResponse = await client.post('/academic-periods').set(headers).send({
      year: 2026,
      term: 1,
    });
    expect(duplicateResponse.status).toBe(409);

    const updateResponse = await client
      .patch(`/academic-periods/${periodId}`)
      .set(headers)
      .send({ term: 2 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.term).toBe(2);

    const deleteResponse = await client
      .delete(`/academic-periods/${periodId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('returns 409 when deleting a period with enrollments', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const student = await createStudentFixture({ institutionId: institution.id });
    await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });

    const response = await client
      .delete(`/academic-periods/${period.id}`)
      .set(
        createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(409);
  });
});
