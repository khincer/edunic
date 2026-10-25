import pg from 'pg';
import { runMigrations, runMigrationsDown } from '@edunic/source/db';

// Migration 0013 renames the `admin` role to `director` and drops the
// `user_institution_roles` table. It only takes effect if the migrator knows
// about it, so the proof runs the real runner on a scratch database: migrate
// up, roll 0013 back, seed an `admin`, migrate up again.
const SCRATCH_DB = 'edu_roles_director';

const ADMIN_USER = '33333333-3333-4333-8333-333333333333';
const TEACHER_USER = '44444444-4444-4444-8444-444444444444';

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

describe('migration 0013 roles director', () => {
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

  async function tableExists(table: string) {
    const result = await db().query(
      'SELECT to_regclass($1) IS NOT NULL AS exists',
      [`public.${table}`]
    );
    return (result.rows[0] as { exists: boolean }).exists;
  }

  async function roleOf(userId: string) {
    const result = await db().query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [userId]
    );
    return (result.rows[0] as { role: string }).role;
  }

  it('is applied by the migrator: user_institution_roles is gone', async () => {
    await withScratchDatabaseUrl(runMigrations);

    expect(await appliedCount()).toBe(15);
    expect(await tableExists('user_institution_roles')).toBe(false);
  }, 60_000);

  it('down brings user_institution_roles back and up renames admin to director', async () => {
    // 0014 (the single_school_id default) comes off first, then 0013 itself.
    await withScratchDatabaseUrl(runMigrationsDown);
    await withScratchDatabaseUrl(runMigrationsDown);
    expect(await appliedCount()).toBe(13);
    expect(await tableExists('user_institution_roles')).toBe(true);

    await db().query(
      `INSERT INTO users (id, email, password_hash) VALUES
         ($1, 'admin@school.test', 'x'),
         ($2, 'teacher@school.test', 'x')`,
      [ADMIN_USER, TEACHER_USER]
    );
    await db().query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin'), ($2, 'teacher')`,
      [ADMIN_USER, TEACHER_USER]
    );

    await withScratchDatabaseUrl(runMigrations);

    expect(await appliedCount()).toBe(15);
    expect(await roleOf(ADMIN_USER)).toBe('director');
    expect(await roleOf(TEACHER_USER)).toBe('teacher');
    expect(await tableExists('user_institution_roles')).toBe(false);
  }, 60_000);
});
