import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export interface CreateDbOptions {
  databaseUrl?: string;
  allowExitOnIdle?: boolean;
}

export function createDb(opts: CreateDbOptions = {}) {
  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    allowExitOnIdle:
      opts.allowExitOnIdle ??
      (process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)),
  });

  // No schema: nothing uses drizzle's relational `db.query` API, and without
  // it the instance has the plain NodePgDatabase type every repository takes.
  const db = drizzle(pool);

  return { pool, db };
}