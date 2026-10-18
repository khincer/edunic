import dotenv from 'dotenv';
import { runMigrationsDown } from '../libs/db/src/run-migrations-down.js';
import { getCliErrorMessage, parseFlags, renderHelp, requireEnv } from './cli-utils.js';

dotenv.config();

async function main() {
  const flags = parseFlags(process.argv.slice(2), []);

  if (flags.help) {
    renderHelp(
      'Roll back the most recent database migration using its sibling .down.sql.',
      ['npm run db:migrate:down'],
      [],
    );
    return;
  }

  requireEnv('DATABASE_URL');

  try {
    console.log('Rolling back the last applied migration...');
    await runMigrationsDown();
    console.log('Rollback completed successfully.');
  } catch (error) {
    console.error(getCliErrorMessage(error));
    process.exitCode = 1;
  }
}

main();
