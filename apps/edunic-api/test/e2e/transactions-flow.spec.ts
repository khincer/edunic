import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 6 (task 3.4, D2 data flow): the transactional enrollment
// journey. A successful create commits the domain row AND its outbox
// event together; a rejected create (duplicate unique enrollment) rolls
// back and leaves neither a row nor an event behind.
const FAKE_STUDENT_ID = '00000000-0000-4000-8000-000000000000';

async function countRows(table: 'enrollments' | 'outbox_events') {
  const result = await db.execute(
    sql.raw(`SELECT COUNT(*)::int AS count FROM ${table}`)
  );
  return (result.rows[0] as { count: number }).count;
}

describe('E2E flow: transactions', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let headers: Record<string, string>;
  let studentId: string;
  let academicPeriodId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await createInstitutionFixture('Transactions Flow Institution');

    const admin = await createUserFixture({
      role: 'director',
      email: 'e2e-admin@transactions-flow.test',
      password: 'admin1234',
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: admin.email, password: admin.password },
    });
    expect(login.statusCode).toBe(200);

    headers = {
      authorization: `Bearer ${login.json().data.token}`,
    };

    const period = await app.inject({
      method: 'POST',
      url: '/academic-periods',
      headers,
      payload: {
        year: 2026,
        term: 1,
        startDate: '2026-01-15',
        endDate: '2026-03-31',
      },
    });
    expect(period.statusCode).toBe(201);
    academicPeriodId = period.json().data.id;

    const student = await app.inject({
      method: 'POST',
      url: '/students',
      headers,
      payload: { firstName: 'Liam', firstLastName: 'Navarro', secondLastName: 'Test', dateOfBirth: '2012-11-03' },
    });
    expect(student.statusCode).toBe(201);
    studentId = student.json().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function createEnrollment(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/enrollments',
      headers,
      payload,
    });
  }

  it('commits the enrollment row and its outbox event together', async () => {
    const created = await createEnrollment({
      studentId,
      academicPeriodId,
      status: 'active',
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      studentId,
      academicPeriodId,
      status: 'active',
    });
    expect(created.json().data).not.toHaveProperty('institutionId');

    // The committed pair: one enrollment row, one outbox event for it.
    expect(await countRows('enrollments')).toBe(1);
    expect(await countRows('outbox_events')).toBe(1);

    const outboxRow = await db.execute(
      sql.raw(`SELECT event->>'name' AS name, event::text ILIKE '%institution%' AS "namesSchool" FROM outbox_events`)
    );
    expect(outboxRow.rows).toEqual([
      { name: 'enrollment.created', namesSchool: false },
    ]);
  });

  it('rolls back row and event together when the duplicate is rejected', async () => {
    const first = await createEnrollment({
      studentId,
      academicPeriodId,
      status: 'active',
    });
    expect(first.statusCode).toBe(201);
    expect(await countRows('enrollments')).toBe(1);
    expect(await countRows('outbox_events')).toBe(1);

    const duplicate = await createEnrollment({
      studentId,
      academicPeriodId,
      status: 'active',
    });

    expect(duplicate.statusCode).toBe(409);
    const body = duplicate.json();
    expect(body.code).toBe('CONFLICT');
    expect(body.message).toBe(
      'Student is already enrolled in this academic period'
    );
    expect(typeof body.correlationId).toBe('string');
    expect(body).not.toHaveProperty('data');

    // The rejected transaction added neither a row nor an event.
    expect(await countRows('enrollments')).toBe(1);
    expect(await countRows('outbox_events')).toBe(1);
  });

  it('answers NOT_FOUND and writes nothing for an unknown student', async () => {
    const response = await createEnrollment({
      studentId: FAKE_STUDENT_ID,
      academicPeriodId,
      status: 'active',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe('NOT_FOUND');
    expect(response.json().message).toBe('Student not found');

    expect(await countRows('enrollments')).toBe(0);
    expect(await countRows('outbox_events')).toBe(0);
  });
});
