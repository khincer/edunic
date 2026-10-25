import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 5 (task 3.4, P3-R5): the classes (classrooms) journey. Admin
// logs in, creates a classroom through the API, hits the duplicate
// CONFLICT contract, updates the row, and reads it back filtered. DB
// state is asserted after every mutation.
async function countClassrooms() {
  const result = await db.execute(
    sql.raw('SELECT COUNT(*)::int AS count FROM classrooms')
  );
  return (result.rows[0] as { count: number }).count;
}

describe('E2E flow: classes', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let institutionId: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const institution = await createInstitutionFixture('Classes Flow Institution');
    institutionId = institution.id;

    const admin = await createUserFixture({
      institutionId,
      role: 'director',
      email: 'e2e-admin@classes-flow.test',
      password: 'admin1234',
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: admin.email, password: admin.password, institutionId },
    });
    expect(login.statusCode).toBe(200);

    headers = {
      authorization: `Bearer ${login.json().data.token}`,
      'x-institution-id': institutionId,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, rejects the duplicate, updates, and lists classrooms', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/classrooms',
      headers,
      payload: { gradeLevel: 7, section: 'B' },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      gradeLevel: 7,
      section: 'B',
    });
    expect(created.json().data).not.toHaveProperty('institutionId');
    const classroomId = created.json().data.id;
    expect(await countClassrooms()).toBe(1);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/classrooms',
      headers,
      payload: { gradeLevel: 7, section: 'B' },
    });

    expect(duplicate.statusCode).toBe(409);
    const conflict = duplicate.json();
    expect(conflict.code).toBe('CONFLICT');
    expect(conflict.message).toBe(
      'Classroom already exists for this grade and section'
    );
    expect(typeof conflict.correlationId).toBe('string');
    expect(conflict).not.toHaveProperty('data');
    // The duplicate attempt inserted nothing.
    expect(await countClassrooms()).toBe(1);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/classrooms/${classroomId}`,
      headers,
      payload: { section: 'C' },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({ gradeLevel: 7, section: 'C' });

    const list = await app.inject({
      method: 'GET',
      url: '/classrooms?gradeLevel=7',
      headers,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0]).toMatchObject({
      id: classroomId,
      section: 'C',
    });

    // DB state: one classroom, carrying the update.
    const rows = await db.execute(
      sql.raw('SELECT grade_level, section FROM classrooms')
    );
    expect(rows.rows).toEqual([{ grade_level: 7, section: 'C' }]);
  });

  it('answers CONFLICT when an update moves a classroom onto an existing slot', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/classrooms',
      headers,
      payload: { gradeLevel: 7, section: 'B' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/classrooms',
      headers,
      payload: { gradeLevel: 8, section: 'A' },
    });
    expect(second.statusCode).toBe(201);
    expect(await countClassrooms()).toBe(2);

    const move = await app.inject({
      method: 'PATCH',
      url: `/classrooms/${second.json().data.id}`,
      headers,
      payload: { gradeLevel: 7, section: 'B' },
    });

    expect(move.statusCode).toBe(409);
    expect(move.json().code).toBe('CONFLICT');

    // The rejected move left both rows untouched.
    const rows = await db.execute(
      sql.raw('SELECT grade_level, section FROM classrooms ORDER BY grade_level')
    );
    expect(rows.rows).toEqual([
      { grade_level: 7, section: 'B' },
      { grade_level: 8, section: 'A' },
    ]);
  });
});
