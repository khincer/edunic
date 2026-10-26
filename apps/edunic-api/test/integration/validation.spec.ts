import { jest } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { StudentsService } from '@edunic/source/domain/students';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

async function countRows(tableName: 'students' | 'enrollments') {
  const result = await db.execute(
    sql.raw(`SELECT COUNT(*)::int AS count FROM ${tableName}`)
  );
  return (result.rows[0] as { count: number }).count;
}

describe('pre-service validation contract (P2-R2)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await createInstitutionFixture();
    const adminUser = await createUserFixture({
      role: 'director',
    });

    headers = await createAuthHeaders({
      userId: adminUser.id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid POST body with 400 VALIDATION_ERROR, details, and no service call', async () => {
    const createStudent = jest
      .spyOn(StudentsService.prototype, 'createStudent')
      .mockRejectedValue(new Error('service must not be called'));

    try {
      const response = await client
        .post('/students')
        .set(headers)
        .send({ firstName: 123 });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.correlationId).toBeTruthy();
      expect(response.body.details.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'firstName' }),
        ])
      );
      expect(createStudent).not.toHaveBeenCalled();
      expect(await countRows('students')).toBe(0);
    } finally {
      createStudent.mockRestore();
    }
  });

  it('rejects an invalid PATCH params and body with details and no service call', async () => {
    const updateStudent = jest
      .spyOn(StudentsService.prototype, 'updateStudent')
      .mockRejectedValue(new Error('service must not be called'));

    try {
      const invalidParams = await client
        .patch('/students/not-a-uuid')
        .set(headers)
        .send({ firstName: 'Valid' });

      expect(invalidParams.status).toBe(400);
      expect(invalidParams.body.code).toBe('VALIDATION_ERROR');
      expect(invalidParams.body.details.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'studentId' }),
        ])
      );

      const student = await createStudentFixture({});
      const invalidBody = await client
        .patch(`/students/${student.id}`)
        .set(headers)
        .send({ dateOfBirth: 'not-a-date' });

      expect(invalidBody.status).toBe(400);
      expect(invalidBody.body.code).toBe('VALIDATION_ERROR');
      expect(invalidBody.body.details.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'dateOfBirth' }),
        ])
      );
      expect(updateStudent).not.toHaveBeenCalled();
    } finally {
      updateStudent.mockRestore();
    }
  });

  it('rejects an invalid query with details before the list service runs', async () => {
    const response = await client
      .get('/students?limit=not-a-number')
      .set(headers);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'limit' })])
    );
  });

  it('rejects an invalid enrollment body with details and persists nothing', async () => {
    const student = await createStudentFixture({});
    const period = await createAcademicPeriodFixture({});
    const classroom = await createClassroomFixture({});

    const response = await client
      .post('/enrollments')
      .set(headers)
      .send({
        studentId: student.id,
        academicPeriodId: period.id,
        classroomId: classroom.id,
        status: 'not-a-status',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'status' })])
    );
    expect(await countRows('enrollments')).toBe(0);
  });
});
