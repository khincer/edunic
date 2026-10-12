import dotenv from 'dotenv';
import { runMigrations } from '../libs/db/src/run-migrations.js';
import { getCliErrorMessage, parseFlags, renderHelp, requireEnv } from './cli-utils.js';

dotenv.config();

async function main() {
  const flags = parseFlags(process.argv.slice(2), []);

  if (flags.help) {
    renderHelp(
      'Run database migrations using Drizzle.',
      ['npm run db:migrate'],
      [],
    );
    return;
  }

  requireEnv('DATABASE_URL');

  try {
    console.log('Running migrations...');
    await runMigrations();
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error(getCliErrorMessage(error));
    process.exitCode = 1;
  }
}

main();