import { migrate } from 'drizzle-orm/node-postgres/migrator';
import dotenv from 'dotenv';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Migration failed: DATABASE_URL is not set.');
  process.exit(1);
}

async function runMigrations() {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool);

  try {
    console.log('Running migrations...');
    await migrate(db, {
      migrationsFolder: 'libs/db/src/migrations',
    });
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations();
