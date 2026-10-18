import pg from 'pg';
import { runMigrations, runMigrationsDown } from '@edunic/source/db';

// P4-R6 / D6: every migration (0000-0006, incl. pre-existing) ships a sibling
// .down.sql and the down runner walks the chain backwards on a real Postgres.
// The scratch database is created empty, migrated up, rolled fully down and
// migrated up again — the up -> down -> up chain the rollback runbook relies on.
const SCRATCH_DB = 'edu_s5_rollback';

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

describe('migration down runner (P4-R6, D6)', () => {
  const admin = new pg.Client({ connectionString: adminUrl() });
  // pg.Client instances cannot be reconnected after end(), so each database
  // recreation gets a fresh scratch client.
  let scratch: pg.Client | undefined;

  beforeAll(async () => {
    await admin.connect();
  });

  afterAll(async () => {
    if (scratch) {
      await scratch.end();
    }
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  });

  async function recreateScratchDatabase() {
    if (scratch) {
      await scratch.end();
    }
    scratch = new pg.Client({ connectionString: scratchUrl() });
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await scratch.connect();
  }

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

  it('up -> down -> up restores the full schema (0006 down to 0000)', async () => {
    await recreateScratchDatabase();
    await withScratchDatabaseUrl(runMigrations);
    expect(await appliedCount()).toBe(7);

    for (let step = 0; step < 7; step += 1) {
      await withScratchDatabaseUrl(runMigrationsDown);
    }
    expect(await appliedCount()).toBe(0);
    for (const table of ['outbox_events', 'report_history', 'users', 'students']) {
      expect(await tableExists(table)).toBe(false);
    }

    await withScratchDatabaseUrl(runMigrations);
    expect(await appliedCount()).toBe(7);
    for (const table of ['outbox_events', 'report_history', 'users', 'students']) {
      expect(await tableExists(table)).toBe(true);
    }
  }, 60_000);

  it('rolls back exactly one migration per step (0006, then 0005)', async () => {
    await recreateScratchDatabase();
    await withScratchDatabaseUrl(runMigrations);

    await withScratchDatabaseUrl(runMigrationsDown);
    expect(await appliedCount()).toBe(6);
    expect(await tableExists('outbox_events')).toBe(false);
    expect(await tableExists('report_history')).toBe(true);
    expect(await tableExists('users')).toBe(true);

    await withScratchDatabaseUrl(runMigrationsDown);
    expect(await appliedCount()).toBe(5);
    expect(await tableExists('report_history')).toBe(false);
    expect(await tableExists('messages')).toBe(false);
    expect(await tableExists('users')).toBe(true);
  }, 60_000);

  it('rejects with a clear error when there is nothing to roll back', async () => {
    await recreateScratchDatabase();
    await expect(withScratchDatabaseUrl(runMigrationsDown)).rejects.toThrow(
      'No migrations to roll back'
    );
  }, 60_000);
});
