import dotenv from 'dotenv';
import { createDb } from './create-db';
import { runMigrations } from './run-migrations';

dotenv.config();

export const { pool, db } = createDb({
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/edu_platform',
});

export { createDb, runMigrations };