import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

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

  const db = drizzle(pool, { schema });

  return { pool, db };
}