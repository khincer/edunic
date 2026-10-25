import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createSubjectFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('notifications routes', () => {
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

  it('creates notifications from domain events when enabled', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({
      institutionId: institution.id,
    });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    await client.post('/extensions').set(headers).send({
      key: 'notifications',
      name: 'Notifications',
      enabled: true,
    });
    await client
      .put('/extensions/notifications/config')
      .set(headers)
      .send({ config: {} });

    const gradeResponse = await client.post('/grades').set(headers).send({
      enrollmentId: enrollment.id,
      subjectId: (await createSubjectFixture('Mathematics')).id,
      score: 95,
    });

    expect(gradeResponse.status).toBe(201);

    const notificationsResponse = await client.get('/notifications').set(headers);

    expect(notificationsResponse.status).toBe(200);
    expect(notificationsResponse.body.data[0].eventName).toBe('grade.submitted');
  });

  it('creates no notifications while the extension has no config', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const period = await createAcademicPeriodFixture({
      institutionId: institution.id,
    });
    const enrollment = await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    await client.post('/extensions').set(headers).send({
      key: 'notifications',
      name: 'Notifications',
      enabled: true,
    });

    const gradeResponse = await client.post('/grades').set(headers).send({
      enrollmentId: enrollment.id,
      subjectId: (await createSubjectFixture('Mathematics')).id,
      score: 95,
    });

    expect(gradeResponse.status).toBe(201);

    const notificationsResponse = await client.get('/notifications').set(headers);

    expect(notificationsResponse.status).toBe(200);
    expect(notificationsResponse.body.data).toEqual([]);
  });

  it('allows parent users to read scoped notifications', async () => {
    const institution = await createInstitutionFixture();
    const parentUser = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });

    const response = await client
      .get('/notifications')
      .set(
        await createAuthHeaders({
          userId: parentUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });
});
