import pg from 'pg';
import { createDb, runMigrations } from '@edunic/source/db';
// tools/ is not an Nx project, so the seed script is imported by path.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { seedDatabase } from '../../../../tools/seed';

// TEN-08 / TEN-01 / SUB-04 / SUB-05 on a from-scratch database (Engram #998).
// Migration 0010's backfills run on an EMPTY database when the order is
// drop -> migrate -> seed, so the seed has to write the single-school rows
// itself: one `institutions` configuration row, one role per user, the
// subjects catalog, and grades that point at a materia. Flags and extensions
// are global.
const SCRATCH_DB = 'edu_seed_single_school';

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

describe('seed on a freshly migrated database', () => {
  const admin = new pg.Client({ connectionString: adminUrl() });
  const scratch = new pg.Client({ connectionString: scratchUrl() });
  const previousUrl = process.env.DATABASE_URL;
  // The seed writes through its own pool on the scratch database.
  const seedTarget = createDb({ databaseUrl: scratchUrl() });

  async function count(query: string): Promise<number> {
    const result = await scratch.query(query);
    return (result.rows[0] as { count: number }).count;
  }

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await scratch.connect();

    process.env.DATABASE_URL = scratchUrl();
    await runMigrations();

    await seedDatabase(seedTarget.db);
  }, 120_000);

  afterAll(async () => {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
    await seedTarget.pool.end();
    await scratch.end();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  it('seeds exactly one institutions row with a sender identity', async () => {
    const result = await scratch.query(
      'SELECT name, sender_name, reply_to_email FROM institutions'
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      sender_name: expect.any(String),
      reply_to_email: expect.any(String),
    });
  });

  it('gives every user exactly one role, covering the demo roles', async () => {
    expect(await count('SELECT COUNT(*)::int AS count FROM users')).toBeGreaterThan(0);
    expect(
      await count(
        `SELECT COUNT(*)::int AS count FROM users u
          WHERE (SELECT COUNT(*) FROM user_roles r WHERE r.user_id = u.id) <> 1`
      )
    ).toBe(0);

    const roles = await scratch.query(
      `SELECT u.email, r.role FROM users u JOIN user_roles r ON r.user_id = u.id`
    );
    const byEmail = Object.fromEntries(
      roles.rows.map((row: { email: string; role: string }) => [
        row.email,
        row.role,
      ])
    );
    // Every role of the model has a demo account (ROLE-02).
    expect(byEmail).toEqual({
      'admin@central.edu': 'director',
      'vicedirector@central.edu': 'vice_director',
      'subdirector@central.edu': 'subdirector',
      'teacher@central.edu': 'teacher',
      'parent@central.edu': 'parent',
    });
  });

  it('seeds the subjects catalog and gives every grade a subject', async () => {
    expect(await count('SELECT COUNT(*)::int AS count FROM subjects')).toBeGreaterThan(0);
    expect(await count('SELECT COUNT(*)::int AS count FROM grades')).toBeGreaterThan(0);
    expect(
      await count(
        'SELECT COUNT(*)::int AS count FROM grades WHERE subject_id IS NULL'
      )
    ).toBe(0);
  });

  it('seeds no school column anywhere (0015)', async () => {
    expect(
      await count(
        `SELECT COUNT(*)::int AS count FROM information_schema.columns
          WHERE table_schema = 'public' AND column_name = 'institution_id'`
      )
    ).toBe(0);
    expect(await count('SELECT COUNT(*)::int AS count FROM classrooms')).toBeGreaterThan(0);
    expect(await count('SELECT COUNT(*)::int AS count FROM students')).toBeGreaterThan(0);
  });

  it('keeps feature flags and extensions global', async () => {
    const perSchool = await scratch.query(
      `SELECT to_regclass('public.institution_feature_flags') AS flags,
              to_regclass('public.institution_extensions') AS extensions`
    );
    expect(perSchool.rows).toEqual([{ flags: null, extensions: null }]);

    const flags = await scratch.query('SELECT key, default_value FROM feature_flags');
    const byKey = Object.fromEntries(
      flags.rows.map((row: { key: string; default_value: boolean }) => [
        row.key,
        row.default_value,
      ])
    );
    expect(byKey).toMatchObject({
      assignments_module: true,
      calendar_module: true,
      parent_portal: true,
      reports_pdf: true,
      custom_fields: true,
      messaging_module: true,
      teacher_gradebook: true,
      billing_module: false,
      email_notifications: false,
    });

    const extension = await scratch.query(
      `SELECT enabled, config FROM extensions WHERE key = 'notifications'`
    );
    expect(extension.rows).toEqual([{ enabled: true, config: {} }]);
  });

  it('can be run twice without duplicating anything', async () => {
    const before = await count('SELECT COUNT(*)::int AS count FROM grades');
    await seedDatabase(seedTarget.db);

    expect(await count('SELECT COUNT(*)::int AS count FROM grades')).toBe(before);
    expect(await count('SELECT COUNT(*)::int AS count FROM institutions')).toBe(1);
  });
});
