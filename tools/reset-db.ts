import { execSync } from "node:child_process";

try {
  console.log('Resetting database...');
  execSync('npx drizzle-kit drop --config=libs/db/src/drizzle.config.ts', { stdio: 'inherit' });
  execSync('npx drizzle-kit migrate --config=libs/db/src/drizzle.config.ts', { stdio: 'inherit' });
  execSync('npx tsx tools/seed.ts', { stdio: 'inherit' });

  console.log('✅ Database reset complete');
} catch (err) {
  console.error('❌ Reset failed', err);
  process.exit(1);
}
