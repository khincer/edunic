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
      role: 'director',
    });
    const headers = await createAuthHeaders({
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
    expect(createResponse.body.data).not.toHaveProperty('institutionId');
    const periodId = createResponse.body.data.id;

    const duplicateResponse = await client.post('/academic-periods').set(headers).send({
      year: 2026,
      term: 1,
    });
    expect(duplicateResponse.status).toBe(409);

    // The UNIQUE key still carries institution_id until 0015: with one school
    // the app-level check is what keeps (year, term) unique.
    const secondResponse = await client.post('/academic-periods').set(headers).send({
      year: 2026,
      term: 2,
    });
    expect(secondResponse.status).toBe(201);

    const collidingUpdate = await client
      .patch(`/academic-periods/${secondResponse.body.data.id}`)
      .set(headers)
      .send({ term: 1 });
    expect(collidingUpdate.status).toBe(409);

    const getResponse = await client
      .get(`/academic-periods/${periodId}`)
      .set(headers);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data).not.toHaveProperty('institutionId');

    const listResponse = await client.get('/academic-periods?year=2026').set(headers);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(2);
    for (const item of listResponse.body.data) {
      expect(item).not.toHaveProperty('institutionId');
    }

    const updateResponse = await client
      .patch(`/academic-periods/${periodId}`)
      .set(headers)
      .send({ term: 3 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.term).toBe(3);

    const deleteResponse = await client
      .delete(`/academic-periods/${periodId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('returns 409 when deleting a period with enrollments', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
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
        await createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(409);
  });
});
