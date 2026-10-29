import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 2 (task 3.3, P3-R5): admin logs in, then runs the student
// lifecycle through the API — create, read, update, list — with the
// response envelope and the persisted DB rows asserted at each step.
async function countStudents() {
  const result = await db.execute(
    sql.raw('SELECT COUNT(*)::int AS count FROM students')
  );
  return (result.rows[0] as { count: number }).count;
}

describe('E2E flow: students', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { email: string; password: string };

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await createInstitutionFixture('Students Flow Institution');

    admin = await createUserFixture({
      role: 'director',
      email: 'e2e-admin@students-flow.test',
      password: 'admin1234',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAsAdmin() {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: admin.email, password: admin.password },
    });

    expect(response.statusCode).toBe(200);

    return {
      authorization: `Bearer ${response.json().data.token}`,
    };
  }

  it('walks the student lifecycle: create, read, update, list', async () => {
    const headers = await loginAsAdmin();

    const created = await app.inject({
      method: 'POST',
      url: '/students',
      headers,
      payload: {
        firstName: 'Sofia',
        firstLastName: 'Ramirez',
        secondLastName: 'Ortega',
        dateOfBirth: '2014-02-10',
      },
    });

    expect(created.statusCode).toBe(201);
    const student = created.json().data;
    expect(student).toMatchObject({
      firstName: 'Sofia',
      secondName: null,
      firstLastName: 'Ramirez',
      secondLastName: 'Ortega',
      fullName: 'Sofia Ramirez Ortega',
      dateOfBirth: '2014-02-10',
    });
    expect(student).not.toHaveProperty('institutionId');

    const fetched = await app.inject({
      method: 'GET',
      url: `/students/${student.id}`,
      headers,
    });

    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data).toMatchObject({
      id: student.id,
      firstName: 'Sofia',
    });

    const updated = await app.inject({
      method: 'PATCH',
      url: `/students/${student.id}`,
      headers,
      payload: { firstLastName: 'Santos' },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({
      id: student.id,
      firstName: 'Sofia',
      firstLastName: 'Santos',
      fullName: 'Sofia Santos Ortega',
    });

    const list = await app.inject({
      method: 'GET',
      url: '/students?limit=10',
      headers,
    });

    expect(list.statusCode).toBe(200);
    const listBody = list.json();
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]).toMatchObject({
      id: student.id,
      firstLastName: 'Santos',
    });
    expect(listBody.meta).toEqual({ total: 1, limit: 10, offset: 0 });

    // DB state: the lifecycle ended with exactly one updated row.
    const rows = await db.execute(
      sql.raw('SELECT first_last_name, second_last_name FROM students')
    );
    expect(rows.rows).toEqual([
      { first_last_name: 'Santos', second_last_name: 'Ortega' },
    ]);
  });
});
