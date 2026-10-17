import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 1 (task 3.3, P3-R5): the real /auth/login endpoint issues a token
// that then drives a protected write. Response envelopes and DB state are
// asserted at every step; no test-only auth shortcuts (no signed JWT helper).
async function countStudents() {
  const result = await db.execute(
    sql.raw('SELECT COUNT(*)::int AS count FROM students')
  );
  return (result.rows[0] as { count: number }).count;
}

describe('E2E flow: auth', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let institutionId: string;
  let adminEmail: string;
  let adminPassword: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const institution = await createInstitutionFixture('Auth Flow Institution');
    institutionId = institution.id;

    const admin = await createUserFixture({
      institutionId,
      role: 'admin',
      email: 'e2e-admin@auth-flow.test',
      password: 'admin1234',
    });
    adminEmail = admin.email;
    adminPassword = admin.password;
  });

  afterAll(async () => {
    await app.close();
  });

  function login(email: string, password: string) {
    return app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password, institutionId },
    });
  }

  it('answers the UNAUTHORIZED envelope for wrong credentials', async () => {
    const response = await login(adminEmail, 'wrong-password');

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.message).toBe('Invalid credentials');
    expect(typeof body.correlationId).toBe('string');
    expect(body).not.toHaveProperty('data');
  });

  it('issues a token that carries an admin through a protected write journey', async () => {
    const loginResponse = await login(adminEmail, adminPassword);

    expect(loginResponse.statusCode).toBe(200);
    const session = loginResponse.json().data;
    expect(typeof session.token).toBe('string');
    expect(session.user).toMatchObject({
      email: adminEmail,
      institutionId,
      role: 'admin',
    });

    const headers = {
      authorization: `Bearer ${session.token}`,
      'x-institution-id': institutionId,
    };

    const created = await app.inject({
      method: 'POST',
      url: '/students',
      headers,
      payload: { firstName: 'E2E', lastName: 'Student', dateOfBirth: '2015-06-01' },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().data.firstName).toBe('E2E');
    const studentId = created.json().data.id;

    const list = await app.inject({ method: 'GET', url: '/students', headers });

    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((row: { id: string }) => row.id)).toContain(
      studentId
    );

    // The API journey persisted exactly one student row.
    expect(await countStudents()).toBe(1);
  });

  it('scopes login tokens by role: a teacher token cannot run the admin write', async () => {
    const teacher = await createUserFixture({
      institutionId,
      role: 'teacher',
      email: 'e2e-teacher@auth-flow.test',
      password: 'teacher1234',
    });

    const loginResponse = await login(teacher.email, teacher.password);

    expect(loginResponse.statusCode).toBe(200);
    const session = loginResponse.json().data;
    expect(session.user.role).toBe('teacher');

    const response = await app.inject({
      method: 'POST',
      url: '/students',
      headers: {
        authorization: `Bearer ${session.token}`,
        'x-institution-id': institutionId,
      },
      payload: { firstName: 'Blocked', lastName: 'Write' },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.code).toBe('FORBIDDEN');
    expect(typeof body.correlationId).toBe('string');
    expect(await countStudents()).toBe(0);
  });
});
