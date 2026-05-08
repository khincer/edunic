import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/edu_platform';

export default defineConfig({
  schema: './libs/db/src/schema',
  out: './libs/db/src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
