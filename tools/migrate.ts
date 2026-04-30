import { execSync } from 'node:child_process';

export function runMigrations() {
  console.log('Running migration...');
  execSync('npx drizzle-kit migrate --config=libs/db/src/drizzle.config.ts', {
    stdio: 'inherit',
  });
  console.log('Migration completed successfully.');
}

try {
  runMigrations();
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
