import pg from 'pg';
import { runMigrations } from '@edunic/source/db';

// P2-R7 / P3-R4: Postgres itself must reject bad rows (FK, NOT NULL, CHECK,
// unique enrollment) — these probes bypass the API and repositories entirely.
// The scratch database is created empty and migrated from scratch, so the
// suite also proves every migration applies on a fresh database.
const SCRATCH_DB = 'edu_s3a_constraints';

const IDS = {
  institution: '11111111-0000-4000-8000-000000000001',
  student: '22222222-0000-4000-8000-000000000002',
  period: '33333333-0000-4000-8000-000000000003',
  enrollment: '44444444-0000-4000-8000-000000000004',
  otherEnrollment: '55555555-0000-4000-8000-000000000005',
  unknownId: '99999999-9999-4999-8999-999999999999',
  subject: '66666666-0000-4000-8000-000000000006',
};

function scratchUrl() {
  const base = new URL(
    process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/edu_platform'
  );
  base.pathname = `/${SCRATCH_DB}`;
  return base.toString();
}

function adminUrl() {
  const url = new URL(scratchUrl());
  url.pathname = '/postgres';
  return url.toString();
}

async function migrateScratchDatabase() {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = scratchUrl();

  try {
    await runMigrations();
  } finally {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  }
}

describe('DB constraints on a fresh database (P2-R7, P3-R4)', () => {
  const admin = new pg.Client({ connectionString: adminUrl() });
  const scratch = new pg.Client({ connectionString: scratchUrl() });

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);

    await migrateScratchDatabase();
    await scratch.connect();

    // Parent rows every probe builds on.
    await scratch.query(
      `INSERT INTO institutions (id, name) VALUES ($1, 'Fresh DB Institution')`,
      [IDS.institution]
    );
    await scratch.query(
      `INSERT INTO students (id, institution_id, first_name, last_name)
       VALUES ($1, $2, 'Jane', 'Doe')`,
      [IDS.student, IDS.institution]
    );
    await scratch.query(
      `INSERT INTO academic_periods (id, institution_id, year, term, start_date, end_date)
       VALUES ($1, $2, 2026, 1, '2026-01-15', '2026-03-31')`,
      [IDS.period, IDS.institution]
    );
    await scratch.query(
      `INSERT INTO enrollments (id, institution_id, student_id, academic_period_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [IDS.enrollment, IDS.institution, IDS.student, IDS.period]
    );
  }, 60_000);

  afterAll(async () => {
    await scratch.end();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  it('applies every migration to a fresh database', async () => {
    const migrations = await scratch.query(
      'SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations'
    );
    expect(migrations.rows[0]).toEqual({ count: 13 });

    const tables = [
      'users',
      'students',
      'academic_periods',
      'enrollments',
      'grades',
      'attendance',
      'outbox_events',
      'email_deliveries',
    ];
    const result = await scratch.query(
      `SELECT ${tables
        .map((table, index) => `to_regclass('public.${table}') IS NOT NULL AS t${index}`)
        .join(', ')}`
    );
    expect(Object.values(result.rows[0])).toEqual(tables.map(() => true));

    const seeded = await scratch.query(
      'SELECT COUNT(*)::int AS count FROM students'
    );
    expect(seeded.rows[0]).toEqual({ count: 1 });
  });

  it('rejects foreign-key violations directly', async () => {
    await expect(
      scratch.query(
        `INSERT INTO enrollments (institution_id, student_id, academic_period_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [IDS.institution, IDS.unknownId, IDS.period]
      )
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'enrollments_student_id_students_id_fk',
    });

    await scratch.query(
      `INSERT INTO subjects (id, name) VALUES ($1, 'Mathematics')`,
      [IDS.subject]
    );

    await expect(
      scratch.query(
        `INSERT INTO grades (institution_id, enrollment_id, subject_id, score)
         VALUES ($1, $2, $3, 90)`,
        [IDS.institution, IDS.unknownId, IDS.subject]
      )
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'grades_enrollment_id_enrollments_id_fk',
    });
  });

  it('rejects NOT NULL violations directly', async () => {
    // Column-level NOT NULL rejections name the offending column in `message`
    // and leave `constraint` unset (only named constraints set it).
    await expect(
      scratch.query(
        `INSERT INTO students (id, institution_id, first_name, last_name)
         VALUES ($1, $2, NULL, 'NoFirst')`,
        [IDS.unknownId, IDS.institution]
      )
    ).rejects.toMatchObject({
      code: '23502',
      message: expect.stringContaining('"first_name"'),
      detail: expect.stringContaining('Failing row contains'),
    });

    await expect(
      scratch.query(
        `INSERT INTO grades (institution_id, enrollment_id, subject_id, score)
         VALUES ($1, $2, NULL, 90)`,
        [IDS.institution, IDS.enrollment]
      )
    ).rejects.toMatchObject({
      code: '23502',
      message: expect.stringContaining('"subject_id"'),
    });
  });

  it('rejects CHECK violations directly', async () => {
    await expect(
      scratch.query(
        `INSERT INTO enrollments (institution_id, student_id, academic_period_id, status)
         VALUES ($1, $2, $3, 'bogus')`,
        [IDS.institution, IDS.student, IDS.period]
      )
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'enrollments_status_check',
    });

    await expect(
      scratch.query(
        `INSERT INTO grades (institution_id, enrollment_id, subject_id, score)
         VALUES ($1, $2, $3, 150)`,
        [IDS.institution, IDS.enrollment, IDS.subject]
      )
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'grades_score_check',
    });

    await expect(
      scratch.query(
        `INSERT INTO attendance (institution_id, enrollment_id, date, status)
         VALUES ($1, $2, '2026-02-01', 'sick')`,
        [IDS.institution, IDS.enrollment]
      )
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'attendance_status_check',
    });
  });

  it('rejects duplicate enrollments for the same student and period', async () => {
    await expect(
      scratch.query(
        `INSERT INTO enrollments (id, institution_id, student_id, academic_period_id, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [IDS.otherEnrollment, IDS.institution, IDS.student, IDS.period]
      )
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'enrollments_student_id_academic_period_id_unique',
    });
  });
});
