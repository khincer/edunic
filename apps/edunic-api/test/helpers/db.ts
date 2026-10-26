import { sql } from 'drizzle-orm';
import { db, pool, runMigrations } from '@edunic/source/db';

let migrationsApplied = false;

export async function ensureTestDatabaseReady() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set before running API integration tests');
  }

  if (migrationsApplied) {
    return;
  }

  await runMigrations();
  migrationsApplied = true;
}

export async function resetTestDatabase() {
  await db.execute(sql.raw(`
    TRUNCATE TABLE
      payments,
      subject_teachers,
      classroom_subjects,
      topics,
      subjects,
      user_roles,
      outbox_events,
      email_deliveries,
      attendance,
      grades,
      enrollments,
      report_history,
      messages,
      message_threads,
      school_events,
      assignments,
      teacher_classroom_assignments,
      student_guardians,
      guardian_user_links,
      guardians,
      classrooms,
      academic_periods,
      feature_flags,
      custom_field_values,
      custom_fields,
      notifications,
      extensions,
      audit_logs,
      students,
      users,
      institutions
    RESTART IDENTITY CASCADE;
  `));

  // A TRUNCATE also removes the rows migrations seed (0007's
  // `email_notifications` default), so restore them here: a reset database must
  // look like a freshly migrated one.
  await db.execute(sql.raw(`
    INSERT INTO feature_flags (key, default_value)
    VALUES ('email_notifications', false)
    ON CONFLICT (key) DO NOTHING;
  `));
}

export async function closeTestDatabase() {
  await pool.end();
}
