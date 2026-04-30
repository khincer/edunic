import { execSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { db, pool } from '@edunic/source/db';

let migrationsApplied = false;

export async function ensureTestDatabaseReady() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before running API integration tests');
  }

  if (migrationsApplied) {
    return;
  }

  execSync('npx drizzle-kit migrate --config=libs/db/src/drizzle.config.ts', {
    stdio: 'inherit',
  });
  migrationsApplied = true;
}

export async function resetTestDatabase() {
  await db.execute(sql.raw(`
    TRUNCATE TABLE
      attendance,
      grades,
      enrollments,
      student_guardians,
      guardians,
      classrooms,
      academic_periods,
      institution_feature_flags,
      feature_flags,
      custom_field_values,
      custom_fields,
      institution_extensions,
      extensions,
      audit_logs,
      user_institution_roles,
      students,
      users,
      institutions
    RESTART IDENTITY CASCADE;
  `));
}

export async function closeTestDatabase() {
  await pool.end();
}
