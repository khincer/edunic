import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from 'dotenv';
import pg from 'pg';
import * as schema from './schema';

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/edu_platform';

export const pool = new pg.Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });
