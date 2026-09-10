import { migrate } from 'drizzle-orm/node-postgres/migrator';
import dotenv from 'dotenv';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getCliErrorMessage, parseFlags, renderHelp, requireEnv } from './cli-utils.js';

dotenv.config();

async function runMigrations() {
  const flags = parseFlags(process.argv.slice(2), []);

  if (flags.help) {
    renderHelp(
      'Run database migrations using Drizzle.',
      ['npm run db:migrate'],
      [],
    );
    return;
  }

  const databaseUrl = requireEnv('DATABASE_URL');

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
    console.error(getCliErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations();
