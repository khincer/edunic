import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import pg from 'pg';
import { runMigrationsDown } from '@edunic/source/db';
import { classrooms } from '@edunic/source/db/schema';
import { runMigrationsUpTo } from '../helpers/migrations';

// The students table as the column-free 0015 code saw it. 0016 renamed
// last_name, so the live schema no longer matches the 0014 replay.
const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
});

// Migration 0014 is the expand step of the single-school contract: it adds
// `single_school_id()` and makes it the DEFAULT of every `institution_id`
// column, so code that stops writing the column keeps producing valid rows.
// It also copies the per-school feature-flag and extension overrides into the
// global tables. Rules proved here:
//   - the default picks the oldest school (same rule as
//     AuthRepository.findAuthContext), and with no school the insert fails
//     with a NOT NULL violation instead of succeeding silently;
//   - flags: the single school's override replaces the global default_value,
//     overrides of any other school are ignored;
//   - extensions: the single school's config is copied only where the global
//     config is still NULL, so a global value is never clobbered;
//   - the migration can be replayed (idempotent) and its down removes the
//     defaults, the function and the column but leaves every row intact.
// The chain is replayed up to 0014 only: 0015 drops the columns proved here.
const SCRATCH_DB = 'edu_single_school_default';
const MIGRATIONS_DIR = 'libs/db/src/migrations';
const MIGRATION_TAG = '0014_single_school_default';
const MIGRATION_FILE = `${MIGRATIONS_DIR}/${MIGRATION_TAG}.sql`;

const migrateTo0014 = () => runMigrationsUpTo(MIGRATION_TAG);

const OLD_SCHOOL = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const NEW_SCHOOL = '11111111-1111-4111-8111-111111111111';
const NULL_DATE_SCHOOL = '00000000-0000-4000-8000-000000000001';

function scratchUrl() {
  const base = new URL(
    process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/edu_platform'
  );
  base.pathname = `/${SCRATCH_DB}`;
  return base.toString();
}

function adminUrl() {
  const url = new URL(scratchUrl());
  url.pathname = '/postgres';
  return url.toString();
}

async function withScratchDatabaseUrl<T>(fn: () => Promise<T>): Promise<T> {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = scratchUrl();

  try {
    return await fn();
  } finally {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  }
}

describe('migration 0014 single school default', () => {
  const admin = new pg.Client({ connectionString: adminUrl() });
  let scratch: pg.Client | undefined;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    scratch = new pg.Client({ connectionString: scratchUrl() });
    await scratch.connect();
  });

  afterAll(async () => {
    if (scratch) {
      await scratch.end();
    }
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  function db(): pg.Client {
    if (!scratch) {
      throw new Error('scratch database is not connected');
    }
    return scratch;
  }

  async function appliedCount() {
    const result = await db().query(
      'SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations'
    );
    return (result.rows[0] as { count: number }).count;
  }

  async function functionExists() {
    const result = await db().query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'single_school_id'
       ) AS exists`
    );
    return (result.rows[0] as { exists: boolean }).exists;
  }

  async function columnExists(table: string, column: string) {
    const result = await db().query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       ) AS exists`,
      [table, column]
    );
    return (result.rows[0] as { exists: boolean }).exists;
  }

  async function institutionIdColumns() {
    const result = await db().query(
      `SELECT table_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'institution_id'
        ORDER BY table_name`
    );
    return result.rows as {
      table_name: string;
      is_nullable: string;
      column_default: string | null;
    }[];
  }

  async function singleSchoolId() {
    const result = await db().query('SELECT single_school_id() AS id');
    return (result.rows[0] as { id: string | null }).id;
  }

  async function runUpFile() {
    for (const statement of readFileSync(MIGRATION_FILE, 'utf8').split(
      '--> statement-breakpoint'
    )) {
      await db().query(statement);
    }
  }

  async function clearSchools() {
    await db().query('DELETE FROM students');
    await db().query('DELETE FROM classrooms');
    await db().query('DELETE FROM institutions');
  }

  async function insertSchool(id: string, createdAt: string | null) {
    await db().query(
      'INSERT INTO institutions (id, name, created_at) VALUES ($1, $2, $3)',
      [id, `School ${id.slice(0, 4)}`, createdAt]
    );
  }

  // The lookup AuthRepository.findAuthContext runs: the reference for "oldest".
  async function authContextSchoolId() {
    const result = await db().query(
      `SELECT id FROM institutions
        ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1`
    );
    return (result.rows[0] as { id: string } | undefined)?.id ?? null;
  }

  async function insertStudentWithoutSchool(firstName: string) {
    const result = await db().query(
      `INSERT INTO students (first_name, last_name)
       VALUES ($1, 'Default') RETURNING institution_id`,
      [firstName]
    );
    return (result.rows[0] as { institution_id: string }).institution_id;
  }

  it('is applied by the migrator and installs single_school_id()', async () => {
    await withScratchDatabaseUrl(migrateTo0014);

    expect(await appliedCount()).toBe(15);
    expect(await functionExists()).toBe(true);
    expect(await singleSchoolId()).toBeNull();
  }, 60_000);

  it('defaults every institution_id column except the two institution_* tables, keeping NOT NULL', async () => {
    const columns = await institutionIdColumns();

    const defaulted = columns.filter(
      (c) => c.column_default === 'single_school_id()'
    );
    expect(defaulted.map((c) => c.table_name)).toEqual([
      'academic_periods',
      'assignments',
      'attendance',
      'audit_logs',
      'classrooms',
      'custom_fields',
      'email_deliveries',
      'enrollments',
      'grades',
      'guardian_user_links',
      'guardians',
      'message_threads',
      'messages',
      'notifications',
      'report_history',
      'school_events',
      'students',
      'teacher_classroom_assignments',
    ]);
    expect(defaulted.every((c) => c.is_nullable === 'NO')).toBe(true);

    // The two tables dropped later by 0015 keep a plain, explicit column.
    const untouched = columns.filter((c) => c.column_default === null);
    expect(untouched.map((c) => c.table_name)).toEqual([
      'institution_extensions',
      'institution_feature_flags',
    ]);
    expect(columns).toHaveLength(20);
  });

  it('fails loudly with a NOT NULL violation when there is no school', async () => {
    await clearSchools();
    expect(await singleSchoolId()).toBeNull();

    await expect(
      db().query(
        `INSERT INTO students (first_name, last_name) VALUES ('No', 'School')`
      )
    ).rejects.toMatchObject({ code: '23502', column: 'institution_id' });
    await expect(
      db().query(
        `INSERT INTO classrooms (grade_level, section) VALUES ('1', 'A')`
      )
    ).rejects.toMatchObject({ code: '23502', column: 'institution_id' });

    const rows = await db().query('SELECT COUNT(*)::int AS count FROM students');
    expect((rows.rows[0] as { count: number }).count).toBe(0);
  });

  it('inserts that omit institution_id get the only school', async () => {
    await insertSchool(NEW_SCHOOL, '2025-01-01T00:00:00Z');

    expect(await insertStudentWithoutSchool('Solo')).toBe(NEW_SCHOOL);
    const classroom = await db().query(
      `INSERT INTO classrooms (grade_level, section) VALUES ('1', 'A')
       RETURNING institution_id`
    );
    expect((classroom.rows[0] as { institution_id: string }).institution_id).toBe(
      NEW_SCHOOL
    );
  });

  it('with several schools the default picks the oldest, like findAuthContext', async () => {
    // The newest school has the LOWEST id, so ordering by id alone would be wrong.
    await insertSchool(OLD_SCHOOL, '2020-01-01T00:00:00Z');

    expect(await singleSchoolId()).toBe(OLD_SCHOOL);
    expect(await singleSchoolId()).toBe(await authContextSchoolId());
    expect(await insertStudentWithoutSchool('Oldest')).toBe(OLD_SCHOOL);

    // A school without created_at sorts last, even with the lowest id.
    await insertSchool(NULL_DATE_SCHOOL, null);
    expect(await singleSchoolId()).toBe(OLD_SCHOOL);
    expect(await singleSchoolId()).toBe(await authContextSchoolId());
  });

  it('breaks a created_at tie by the lowest id', async () => {
    await clearSchools();
    await insertSchool(OLD_SCHOOL, '2022-05-05T00:00:00Z');
    await insertSchool(NEW_SCHOOL, '2022-05-05T00:00:00Z');

    expect(await singleSchoolId()).toBe(NEW_SCHOOL);
    expect(await singleSchoolId()).toBe(await authContextSchoolId());
    expect(await insertStudentWithoutSchool('Tie')).toBe(NEW_SCHOOL);
  });

  it('down removes the defaults, the function and extensions.config but keeps every row', async () => {
    await clearSchools();
    await insertSchool(OLD_SCHOOL, '2020-01-01T00:00:00Z');
    await insertStudentWithoutSchool('Survivor');
    expect(await columnExists('extensions', 'config')).toBe(true);

    await withScratchDatabaseUrl(runMigrationsDown);

    expect(await appliedCount()).toBe(14);
    expect(await functionExists()).toBe(false);
    expect(await columnExists('extensions', 'config')).toBe(false);
    const columns = await institutionIdColumns();
    expect(columns).toHaveLength(20);
    expect(columns.every((c) => c.column_default === null)).toBe(true);
    expect(columns.every((c) => c.is_nullable === 'NO')).toBe(true);

    const student = await db().query(
      `SELECT institution_id FROM students WHERE first_name = 'Survivor'`
    );
    expect(student.rows).toEqual([{ institution_id: OLD_SCHOOL }]);

    // Without the default, omitting the column is a NOT NULL violation again.
    await expect(
      db().query(
        `INSERT INTO students (first_name, last_name) VALUES ('Old', 'Code')`
      )
    ).rejects.toMatchObject({ code: '23502' });
  }, 60_000);

  it('up copies the single school flag and extension overrides into the global tables', async () => {
    await clearSchools();
    await insertSchool(OLD_SCHOOL, '2020-01-01T00:00:00Z');
    await insertSchool(NEW_SCHOOL, '2025-01-01T00:00:00Z');

    // email_notifications is seeded by 0007 with default_value false.
    await db().query(
      `INSERT INTO feature_flags (key, default_value) VALUES
         ('flag_overridden_off', true),
         ('flag_only_other_school', false),
         ('flag_no_override', true)`
    );
    await db().query(
      `INSERT INTO institution_feature_flags (institution_id, feature_key, enabled) VALUES
         ($1, 'email_notifications', true),
         ($1, 'flag_overridden_off', false),
         ($2, 'email_notifications', false),
         ($2, 'flag_only_other_school', true)`,
      [OLD_SCHOOL, NEW_SCHOOL]
    );
    await db().query(
      `INSERT INTO extensions (key, name) VALUES
         ('ext_configured', 'Configured'),
         ('ext_null_config', 'Null config'),
         ('ext_other_school', 'Other school'),
         ('ext_untouched', 'Untouched')`
    );
    await db().query(
      `INSERT INTO institution_extensions (institution_id, extension_key, config) VALUES
         ($1, 'ext_configured', '{"theme":"blue"}'),
         ($1, 'ext_null_config', NULL),
         ($2, 'ext_configured', '{"theme":"red"}'),
         ($2, 'ext_other_school', '{"theme":"green"}')`,
      [OLD_SCHOOL, NEW_SCHOOL]
    );

    await withScratchDatabaseUrl(migrateTo0014);

    expect(await appliedCount()).toBe(15);
    const flags = await db().query(
      `SELECT key, default_value FROM feature_flags ORDER BY key`
    );
    expect(flags.rows).toEqual([
      { key: 'email_notifications', default_value: true },
      { key: 'flag_no_override', default_value: true },
      { key: 'flag_only_other_school', default_value: false },
      { key: 'flag_overridden_off', default_value: false },
    ]);
    const extensions = await db().query(
      `SELECT key, config FROM extensions ORDER BY key`
    );
    expect(extensions.rows).toEqual([
      { key: 'ext_configured', config: { theme: 'blue' } },
      { key: 'ext_null_config', config: null },
      { key: 'ext_other_school', config: null },
      { key: 'ext_untouched', config: null },
    ]);
    // The per-school rows are left in place for the unswept code.
    const overrides = await db().query(
      'SELECT COUNT(*)::int AS count FROM institution_feature_flags'
    );
    expect((overrides.rows[0] as { count: number }).count).toBe(4);
  }, 60_000);

  it('is idempotent and never clobbers a global extension config', async () => {
    await db().query(
      `UPDATE extensions SET config = '{"theme":"edited"}' WHERE key = 'ext_configured'`
    );
    await db().query(
      `UPDATE extensions SET config = '{"theme":"later"}' WHERE key = 'ext_null_config'`
    );

    await runUpFile();
    await runUpFile();

    expect(await functionExists()).toBe(true);
    const flags = await db().query(
      `SELECT default_value FROM feature_flags WHERE key = 'email_notifications'`
    );
    expect(flags.rows).toEqual([{ default_value: true }]);
    const extensions = await db().query(
      `SELECT key, config FROM extensions
        WHERE key IN ('ext_configured', 'ext_null_config') ORDER BY key`
    );
    expect(extensions.rows).toEqual([
      { key: 'ext_configured', config: { theme: 'edited' } },
      { key: 'ext_null_config', config: { theme: 'later' } },
    ]);
    expect(await appliedCount()).toBe(15);
  });

  it('copies nothing when there is no school', async () => {
    await withScratchDatabaseUrl(runMigrationsDown);
    await db().query('DELETE FROM institution_feature_flags');
    await db().query('DELETE FROM institution_extensions');
    await clearSchools();
    await db().query(
      `UPDATE feature_flags SET default_value = false WHERE key = 'email_notifications'`
    );

    await withScratchDatabaseUrl(migrateTo0014);

    expect(await appliedCount()).toBe(15);
    expect(await singleSchoolId()).toBeNull();
    const flag = await db().query(
      `SELECT default_value FROM feature_flags WHERE key = 'email_notifications'`
    );
    expect(flag.rows).toEqual([{ default_value: false }]);
  }, 60_000);

  // Rolling deploy: code built on the 0015 schema (no school column) may run
  // before 0015 is applied. Its inserts omit the column and get the default.
  it('inserts from the column-free Drizzle schema get the default on the 0014 schema', async () => {
    await insertSchool(OLD_SCHOOL, '2020-01-01T00:00:00Z');
    const orm = drizzle(db());

    const [student] = await orm
      .insert(students)
      .values({ firstName: 'Typed', lastName: 'Insert' })
      .returning({ id: students.id });
    const [classroom] = await orm
      .insert(classrooms)
      .values({ gradeLevel: 9, section: 'Z' })
      .returning({ id: classrooms.id });

    const rows = await db().query(
      `SELECT institution_id FROM students WHERE id = $1
       UNION ALL
       SELECT institution_id FROM classrooms WHERE id = $2`,
      [student.id, classroom.id]
    );
    expect(rows.rows).toEqual([
      { institution_id: OLD_SCHOOL },
      { institution_id: OLD_SCHOOL },
    ]);
  });
});
