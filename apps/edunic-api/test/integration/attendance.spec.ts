import { createTestApp, createHttpClient } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
} from '../helpers/fixtures.js';

describe('attendance routes', () => {
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

  it('supports CRUD for attendance', async () => {
    const institution = await createInstitutionFixture();
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({ institutionId: institution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const headers = { 'x-institution-id': institution.id };

    const createResponse = await client.post('/attendance').set(headers).send({
      enrollmentId: enrollment.id,
      date: '2026-02-05T08:00:00.000Z',
      status: 'present',
    });

    expect(createResponse.status).toBe(201);
    const attendanceId = createResponse.body.data.id;

    const updateResponse = await client
      .patch(`/attendance/${attendanceId}`)
      .set(headers)
      .send({ status: 'late' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.status).toBe('late');

    const deleteResponse = await client
      .delete(`/attendance/${attendanceId}`)
      .set(headers);
    expect(deleteResponse.status).toBe(200);
  });

  it('returns 404 when enrollment is outside the institution', async () => {
    const institution = await createInstitutionFixture();
    const otherInstitution = await createInstitutionFixture('Other');
    const student = await createStudentFixture({ institutionId: otherInstitution.id });
    const period = await createAcademicPeriodFixture({ institutionId: otherInstitution.id });
    const enrollment = await createEnrollmentFixture({
      institutionId: otherInstitution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });

    const response = await client
      .post('/attendance')
      .set({ 'x-institution-id': institution.id })
      .send({
        enrollmentId: enrollment.id,
        date: '2026-02-05T08:00:00.000Z',
        status: 'present',
      });

    expect(response.status).toBe(404);
  });
});
