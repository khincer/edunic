import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { db, runMigrations, runMigrationsDown } from '@edunic/source/db';
import { ensureTestDatabaseReady } from '../helpers/db.js';

const MIGRATIONS_DIR = 'libs/db/src/migrations';

// Rows created by this suite; deleted in afterAll so the shared test database is
// handed back the way it was found.
const createdInstitutions: string[] = [];
const createdUsers: string[] = [];
const createdStudents: string[] = [];

async function columnExists(table: string, column: string) {
  const result = await db.execute(sql`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = ${table} and column_name = ${column}
    ) as exists
  `);
  return (result.rows[0] as { exists: boolean }).exists;
}

async function tableName(table: string) {
  const result = await db.execute(
    sql.raw(`SELECT to_regclass('${table}') AS name`)
  );
  return (result.rows[0] as { name: string | null }).name;
}

async function createInstitution(name: string) {
  const id = randomUUID();
  createdInstitutions.push(id);
  await db.execute(
    sql`insert into institutions (id, name) values (${id}, ${name})`
  );
  return id;
}

async function createUser(email: string) {
  const id = randomUUID();
  createdUsers.push(id);
  await db.execute(
    sql`insert into users (id, email, password_hash)
        values (${id}, ${email}, ${'hash'})`
  );
  return id;
}

async function createStudent(institutionId: string, name: string) {
  const id = randomUUID();
  createdStudents.push(id);
  await db.execute(
    sql`insert into students (id, institution_id, first_name, last_name)
        values (${id}, ${institutionId}, ${name}, ${'Student'})`
  );
  return id;
}

afterAll(async () => {
  for (const id of createdStudents) {
    await db.execute(sql`delete from payments where student_id = ${id}`);
    await db.execute(sql`delete from students where id = ${id}`);
  }
  for (const id of createdUsers) {
    await db.execute(sql`delete from user_roles where user_id = ${id}`);
    await db.execute(sql`delete from subject_teachers where teacher_user_id = ${id}`);
    await db.execute(sql`delete from users where id = ${id}`);
  }
  await db.execute(sql`delete from classroom_subjects`);
  await db.execute(sql`delete from topics`);
  await db.execute(sql`delete from subjects`);
  for (const id of createdInstitutions) {
    await db.execute(sql`delete from institutions where id = ${id}`);
  }
});

describe('migration 0009 single school expand', () => {
  beforeAll(async () => {
    await ensureTestDatabaseReady();
  });

  it('creates the single-school tables', async () => {
    expect(await tableName('user_roles')).toBe('user_roles');
    expect(await tableName('subjects')).toBe('subjects');
    expect(await tableName('topics')).toBe('topics');
    expect(await tableName('classroom_subjects')).toBe('classroom_subjects');
    expect(await tableName('subject_teachers')).toBe('subject_teachers');
    expect(await tableName('payments')).toBe('payments');
  });

  it('adds the subject columns to grades and assignments', async () => {
    expect(await columnExists('grades', 'subject_id')).toBe(true);
    expect(await columnExists('grades', 'topic_id')).toBe(true);
    expect(await columnExists('assignments', 'subject_id')).toBe(true);
    expect(await columnExists('assignments', 'topic_id')).toBe(true);
  });

  it('holds exactly one role per user', async () => {
    const userId = await createUser(`one-role-${randomUUID()}@example.com`);

    await db.execute(
      sql`insert into user_roles (user_id, role) values (${userId}, ${'teacher'})`
    );

    // A second role for the same user is rejected: the single-school model
    // gives a person one role.
    await expect(
      db.execute(
        sql`insert into user_roles (user_id, role) values (${userId}, ${'admin'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23505' } });

    const stored = await db.execute(
      sql`select role from user_roles where user_id = ${userId}`
    );
    expect(stored.rows).toHaveLength(1);
    expect((stored.rows[0] as { role: string }).role).toBe('teacher');
  });

  it('scopes a topic to its subject and a subject name to one row', async () => {
    const subjectId = randomUUID();
    await db.execute(
      sql`insert into subjects (id, name) values (${subjectId}, ${`Math-${randomUUID()}`})`
    );

    const otherSubjectId = randomUUID();
    await db.execute(
      sql`insert into subjects (id, name) values (${otherSubjectId}, ${`Math-${randomUUID()}`})`
    );

    const topicId = randomUUID();
    await db.execute(
      sql`insert into topics (id, subject_id, name)
          values (${topicId}, ${subjectId}, ${'Sums'})`
    );

    // The same topic name under a different subject is a different topic.
    await db.execute(
      sql`insert into topics (id, subject_id, name)
          values (${randomUUID()}, ${otherSubjectId}, ${'Sums'})`
    );

    // The same topic name twice under one subject is rejected.
    await expect(
      db.execute(
        sql`insert into topics (id, subject_id, name)
            values (${randomUUID()}, ${subjectId}, ${'Sums'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23505' } });

    // A topic must point at an existing subject.
    await expect(
      db.execute(
        sql`insert into topics (id, subject_id, name)
            values (${randomUUID()}, ${randomUUID()}, ${'Orphan'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23503' } });

    await db.execute(sql`delete from topics where subject_id = ${subjectId}`);
    await db.execute(sql`delete from topics where subject_id = ${otherSubjectId}`);
    await db.execute(sql`delete from subjects where id = ${subjectId}`);
    await db.execute(sql`delete from subjects where id = ${otherSubjectId}`);
  });

  it('rejects a payment that breaks the ledger rules', async () => {
    const institutionId = await createInstitution('Migration 0009');
    const userId = await createUser(`payments-${randomUUID()}@example.com`);
    const studentId = await createStudent(institutionId, 'Paying');

    const insert = (values: {
      amountCents?: number;
      status?: string;
      paidAt?: string | null;
      receiptNumber?: string;
    }) => {
      const amount = values.amountCents ?? 500;
      const status = values.status ?? 'pending';
      const paidAt =
        values.paidAt === undefined ? null : values.paidAt;
      const receipt = values.receiptNumber ?? `R-${randomUUID()}`;
      return db.execute(
        sql`insert into payments
              (student_id, concept, amount_cents, due_date, paid_at, method, status,
               receipt_number, recorded_by_user_id)
            values (${studentId}, ${'Tuition'}, ${amount},
                    ${new Date('2026-03-01T00:00:00.000Z')}, ${paidAt}, ${'cash'},
                    ${status}, ${receipt}, ${userId})`
      );
    };

    // A valid pending payment.
    await expect(insert({})).resolves.toBeDefined();

    // A paid payment must carry a paid date.
    await expect(insert({ status: 'paid' })).rejects.toMatchObject({
      cause: { code: '23514' },
    });

    // An unpaid payment must not carry one.
    await expect(
      insert({
        status: 'pending',
        paidAt: new Date('2026-02-01T00:00:00.000Z').toISOString(),
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    // An unknown status is rejected.
    await expect(insert({ status: 'bogus' })).rejects.toMatchObject({
      cause: { code: '23514' },
    });

    // A non-positive amount is rejected.
    await expect(insert({ amountCents: 0 })).rejects.toMatchObject({
      cause: { code: '23514' },
    });

    // The receipt number is unique.
    const receipt = `R-${randomUUID()}`;
    await expect(insert({ receiptNumber: receipt })).resolves.toBeDefined();
    await expect(insert({ receiptNumber: receipt })).rejects.toMatchObject({
      cause: { code: '23505' },
    });
  });

  it('down reverses 0009 and up re-applies it cleanly', async () => {
    // 0013, 0012, 0011, 0010 and 0009 come off in order: each of them builds
    // on what the previous one created, and the runner keeps the journal in step.
    await runMigrationsDown();
    await runMigrationsDown();
    await runMigrationsDown();
    await runMigrationsDown();
    await runMigrationsDown();

    expect(await tableName('user_roles')).toBeNull();
    expect(await tableName('subjects')).toBeNull();
    expect(await tableName('payments')).toBeNull();
    expect(await columnExists('grades', 'subject_id')).toBe(false);
    expect(await columnExists('assignments', 'topic_id')).toBe(false);

    await runMigrations();

    expect(await tableName('user_roles')).toBe('user_roles');
    expect(await tableName('payments')).toBe('payments');
    expect(await columnExists('grades', 'subject_id')).toBe(true);

    // The migrator journal stays consistent: a re-run is a no-op, not an error.
    await expect(runMigrations()).resolves.toBeUndefined();
  }, 60_000);
});
