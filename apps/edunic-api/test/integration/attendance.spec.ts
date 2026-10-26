import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
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
    await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      role: 'teacher',
    });
    const classroom = await createClassroomFixture({});
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacherUser.id,
      classroomId: classroom.id,
    });
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    const enrollment = await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
    });
    const headers = await createAuthHeaders({
      userId: teacherUser.id,
    });

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

  it('returns 404 when the enrollment does not exist', async () => {
    await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      role: 'teacher',
    });

    const response = await client
      .post('/attendance')
      .set(
        await createAuthHeaders({
          userId: teacherUser.id,
        })
      )
      .send({
        enrollmentId: '99999999-9999-4999-8999-999999999999',
        date: '2026-02-05T08:00:00.000Z',
        status: 'present',
      });

    expect(response.status).toBe(404);
  });

  it('answers without a school field and keeps one mark per enrollment and date', async () => {
    await createInstitutionFixture();
    const admin = await createUserFixture({
      role: 'director',
    });
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    const enrollment = await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: period.id,
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
    });
    const body = {
      enrollmentId: enrollment.id,
      date: '2026-02-05T08:00:00.000Z',
      status: 'present',
    };

    const created = await client.post('/attendance').set(headers).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data).not.toHaveProperty('institutionId');

    const fetched = await client
      .get(`/attendance/${created.body.data.id}`)
      .set(headers);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).not.toHaveProperty('institutionId');

    const listed = await client.get('/attendance').set(headers);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).not.toHaveProperty('institutionId');

    // UNIQUE (enrollment_id, date) has no school column: a second mark of
    // the same day is still refused and leaves a single row.
    const duplicate = await client.post('/attendance').set(headers).send(body);
    expect(duplicate.status).toBeGreaterThanOrEqual(400);
    const after = await client.get('/attendance').set(headers);
    expect(after.body.data).toHaveLength(1);

    const missing = await client
      .get('/attendance/99999999-9999-4999-8999-999999999999')
      .set(headers);
    expect(missing.status).toBe(404);
  });
});
