import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import { getCliErrorMessage, parseFlags, renderHelp, requireEnv } from './cli-utils.js';

dotenv.config();

const flags = parseFlags(process.argv.slice(2), []);

if (flags.help) {
  renderHelp(
    'Drop, recreate, and reseed the database.',
    ['npm run db:reset'],
    [],
  );
  process.exit(0);
}

requireEnv('DATABASE_URL');

try {
  console.log('Resetting database...');
  execSync('npx drizzle-kit drop --config=libs/db/src/drizzle.config.ts', { stdio: 'inherit' });
  execSync('npx drizzle-kit migrate --config=libs/db/src/drizzle.config.ts', { stdio: 'inherit' });
  execSync('npx tsx tools/seed.ts', { stdio: 'inherit' });

  console.log('Database reset complete.');
} catch (err) {
  console.error('Reset failed:', getCliErrorMessage(err));
  process.exit(1);
}
