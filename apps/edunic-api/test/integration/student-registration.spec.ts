import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type GuardianInput = { name: string; email: string; phone?: string };

async function countRows(table: string) {
  const result = await db.execute(
    sql.raw(`select count(*)::int as count from ${table}`)
  );
  return (result.rows[0] as { count: number }).count;
}

// The audit row is written in onResponse, after the reply reached the client.
async function waitForRegistrationAuditRow() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await db.execute(sql`
      select after from audit_logs
      where after->>'route' = '/students/register'
      limit 1
    `);

    if (result.rows[0]) {
      return (result.rows[0] as { after: unknown }).after;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('No audit row for the registration');
}

describe('POST /students/register', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let adminHeaders: Record<string, string>;
  let classroomId: string;
  let periodId: string;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();
    const admin = await createUserFixture({ role: 'director' });
    adminHeaders = await createAuthHeaders({ userId: admin.id });
    classroomId = (await createClassroomFixture({ gradeLevel: 5, section: 'A' })).id;
    periodId = (
      await createAcademicPeriodFixture({
        year: 2099,
        term: 1,
        startDate: new Date(Date.now() - 30 * DAY_MS),
        endDate: new Date(Date.now() + 30 * DAY_MS),
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      firstName: 'Ana',
      secondName: 'María',
      firstLastName: 'López',
      secondLastName: 'García',
      dateOfBirth: '2015-05-10',
      classroomId,
      guardians: [
        { name: 'Rosa García', email: 'rosa@example.com', phone: '+50588881111' },
      ] as GuardianInput[],
      ...overrides,
    };
  }

  function register(body: unknown, headers = adminHeaders) {
    return client.post('/students/register').set(headers).send(body as object);
  }

  it('registers a student with one guardian, a parent account and an enrollment', async () => {
    const response = await register(payload());

    expect(response.status).toBe(201);
    const { student, guardians, enrollment, academicPeriod } = response.body.data;

    expect(student).toMatchObject({
      firstName: 'Ana',
      secondName: 'María',
      firstLastName: 'López',
      secondLastName: 'García',
      fullName: 'Ana María López García',
      dateOfBirth: '2015-05-10',
    });
    expect(typeof student.age).toBe('number');
    expect(student).not.toHaveProperty('lastName');

    expect(guardians).toHaveLength(1);
    expect(guardians[0]).toMatchObject({
      name: 'Rosa García',
      email: 'rosa@example.com',
      account: { created: true },
    });
    expect(guardians[0].account.temporaryPassword).toEqual(expect.any(String));
    expect(guardians[0].account.temporaryPassword.length).toBeGreaterThanOrEqual(16);

    expect(enrollment).toMatchObject({
      academicPeriodId: periodId,
      classroomId,
      classroom: { id: classroomId, gradeLevel: 5, section: 'A' },
    });
    expect(academicPeriod).toEqual({ id: periodId, year: 2099, term: 1 });

    const role = await db.execute(sql`
      select ur.role from users u
      join user_roles ur on ur.user_id = u.id
      where u.id = ${guardians[0].account.userId}
    `);
    expect(role.rows).toEqual([{ role: 'parent' }]);

    const link = await db.execute(sql`
      select 1 from guardian_user_links
      where guardian_id = ${guardians[0].id} and user_id = ${guardians[0].account.userId}
    `);
    expect(link.rows).toHaveLength(1);

    // The one-time password is the only way in, and it works.
    const login = await client.post('/auth/login').send({
      email: 'rosa@example.com',
      password: guardians[0].account.temporaryPassword,
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('parent');
  });

  it('registers a student with two guardians', async () => {
    const response = await register(
      payload({
        guardians: [
          { name: 'Rosa García', email: 'rosa@example.com' },
          { name: 'Luis López', email: 'luis@example.com', phone: '+50588882222' },
        ],
      })
    );

    expect(response.status).toBe(201);
    expect(response.body.data.guardians).toHaveLength(2);
    expect(
      response.body.data.guardians.every(
        (guardian: { account: { created: boolean } }) => guardian.account.created
      )
    ).toBe(true);
    expect(await countRows('student_guardians')).toBe(2);
  });

  it.each([
    ['no guardians', []],
    [
      'three guardians',
      [
        { name: 'A', email: 'a@example.com' },
        { name: 'B', email: 'b@example.com' },
        { name: 'C', email: 'c@example.com' },
      ],
    ],
  ])('rejects %s with 400', async (_label, guardians) => {
    const response = await register(payload({ guardians }));

    expect(response.status).toBe(400);
    expect(await countRows('students')).toBe(0);
  });

  it('requires the second last name', async () => {
    // An undefined value is dropped from the JSON body.
    const response = await register(payload({ secondLastName: undefined }));

    expect(response.status).toBe(400);
  });

  it('requires a guardian email', async () => {
    const response = await register(
      payload({ guardians: [{ name: 'Rosa García' }] })
    );

    expect(response.status).toBe(400);
  });

  it('accepts a student without a second name', async () => {
    const response = await register(payload({ secondName: undefined }));

    expect(response.status).toBe(201);
    expect(response.body.data.student.secondName).toBeNull();
    expect(response.body.data.student.fullName).toBe('Ana López García');
  });

  it('returns 404 for an unknown classroom', async () => {
    const response = await register(payload({ classroomId: randomUUID() }));

    expect(response.status).toBe(404);
    expect(await countRows('students')).toBe(0);
  });

  it('returns 409 when there is no academic period', async () => {
    await db.execute(sql`delete from academic_periods`);

    const response = await register(payload());

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'No hay un período académico activo. Créelo en Períodos académicos.'
    );
    expect(await countRows('students')).toBe(0);
  });

  it('falls back to the latest period when none covers today', async () => {
    await db.execute(sql`delete from academic_periods`);
    await createAcademicPeriodFixture({
      year: 2020,
      term: 1,
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: new Date('2020-03-31T00:00:00.000Z'),
    });
    const latest = await createAcademicPeriodFixture({
      year: 2021,
      term: 2,
      startDate: new Date('2021-04-01T00:00:00.000Z'),
      endDate: new Date('2021-06-30T00:00:00.000Z'),
    });

    const response = await register(payload());

    expect(response.status).toBe(201);
    expect(response.body.data.academicPeriod).toEqual({
      id: latest.id,
      year: 2021,
      term: 2,
    });
  });

  it.each([
    ['a missing date of birth', { dateOfBirth: undefined }],
    ['a future date of birth', { dateOfBirth: '2999-01-01' }],
    ['a malformed date of birth', { dateOfBirth: '10/05/2015' }],
  ])('rejects %s with 400', async (_label, overrides) => {
    const response = await register(payload(overrides));

    expect(response.status).toBe(400);
  });

  it('links an existing parent account without a new password', async () => {
    const parent = await createUserFixture({
      role: 'parent',
      email: 'rosa@example.com',
    });
    const usersBefore = await countRows('users');

    const response = await register(
      payload({
        guardians: [{ name: 'Rosa García', email: 'ROSA@example.com' }],
      })
    );

    expect(response.status).toBe(201);
    expect(response.body.data.guardians[0].account).toEqual({
      userId: parent.id,
      created: false,
    });
    expect(await countRows('users')).toBe(usersBefore);
  });

  it('returns 409 when the email belongs to a non-parent user and persists nothing', async () => {
    await createUserFixture({ role: 'teacher', email: 'teacher@example.com' });

    const response = await register(
      payload({
        guardians: [
          { name: 'Rosa García', email: 'rosa@example.com' },
          { name: 'Profe', email: 'teacher@example.com' },
        ],
      })
    );

    expect(response.status).toBe(409);
    expect(await countRows('students')).toBe(0);
    expect(await countRows('guardians')).toBe(0);
    expect(await countRows('enrollments')).toBe(0);
    expect(await countRows('outbox_events')).toBe(0);
  });

  it('rejects duplicate guardian emails in one request', async () => {
    const response = await register(
      payload({
        guardians: [
          { name: 'Rosa García', email: 'rosa@example.com' },
          { name: 'Rosa G.', email: ' Rosa@Example.com ' },
        ],
      })
    );

    expect(response.status).toBe(400);
  });

  it('reuses the guardian and the account for a sibling', async () => {
    const first = await register(payload());
    const second = await register(
      payload({ firstName: 'Beto', secondName: undefined })
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const firstGuardian = first.body.data.guardians[0];
    const secondGuardian = second.body.data.guardians[0];

    expect(secondGuardian.id).toBe(firstGuardian.id);
    expect(secondGuardian.account).toEqual({
      userId: firstGuardian.account.userId,
      created: false,
    });
    expect(await countRows('guardians')).toBe(1);
    expect(await countRows('guardian_user_links')).toBe(1);
    expect(await countRows('student_guardians')).toBe(2);
  });

  it.each(['teacher', 'parent'] as const)(
    'returns 403 for a %s caller',
    async (role) => {
      const user = await createUserFixture({ role });

      const response = await register(
        payload(),
        await createAuthHeaders({ userId: user.id })
      );

      expect(response.status).toBe(403);
    }
  );

  it('returns 401 for an anonymous caller', async () => {
    const response = await client.post('/students/register').send(payload());

    expect(response.status).toBe(401);
  });

  it('stages an enrollment.created outbox event', async () => {
    const response = await register(payload());
    const enrollmentId = response.body.data.enrollment.id;

    const events = await db.execute(sql`
      select event from outbox_events
      where event->>'name' = 'enrollment.created'
        and event->'payload'->>'enrollmentId' = ${enrollmentId}
    `);

    expect(events.rows).toHaveLength(1);
  });

  it('never stores the temporary password in the audit log', async () => {
    const response = await register(payload());
    const password = response.body.data.guardians[0].account.temporaryPassword;

    const after = await waitForRegistrationAuditRow();
    const serialized = JSON.stringify(after);

    expect(serialized).not.toContain(password);
    expect(serialized).not.toMatch(/"temporaryPassword":"(?!\[REDACTED\])/);
    expect(serialized).toContain('rosa@example.com');
  });

  it('lists the grado and guardians of a registered student', async () => {
    const response = await register(payload());
    const studentId = response.body.data.student.id;
    const guardianId = response.body.data.guardians[0].id;
    const expected = {
      id: studentId,
      firstLastName: 'López',
      secondLastName: 'García',
      gradeLevel: 5,
      section: 'A',
      classroomId,
      academicPeriodId: periodId,
      guardians: [{ id: guardianId, name: 'Rosa García' }],
    };

    const list = await client.get('/students').set(adminHeaders);
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([expect.objectContaining(expected)]);

    const detail = await client.get(`/students/${studentId}`).set(adminHeaders);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toEqual(expect.objectContaining(expected));
  });

  it('lets a parent see only their own children', async () => {
    const mine = await register(payload());
    await register(
      payload({
        firstName: 'Otro',
        guardians: [{ name: 'Otra Familia', email: 'otra@example.com' }],
      })
    );
    const parentHeaders = await createAuthHeaders({
      userId: mine.body.data.guardians[0].account.userId,
    });

    const list = await client.get('/students').set(parentHeaders);

    expect(list.status).toBe(200);
    expect(list.body.data.map((student: { id: string }) => student.id)).toEqual([
      mine.body.data.student.id,
    ]);
  });
});
