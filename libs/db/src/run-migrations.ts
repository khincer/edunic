import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });
  const db = drizzle(pool);

  try {
    await migrate(db, {
      migrationsFolder: 'libs/db/src/migrations',
    });
  } finally {
    await pool.end();
  }
}