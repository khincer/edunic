import pg from 'pg';
import { runMigrations, runMigrationsDown } from '@edunic/source/db';

// Migration 0015 is the contract step of the single-school change (TEN-01..05,
// NFR-04): the 18 institution_id columns, the two per-school tables and
// single_school_id() are dropped, and the keys that carried the school are
// rebuilt without it. The institutions table stays as the configuration row.
// Rules proved here:
//   - no table has institution_id and no foreign key references institutions;
//   - the new keys reject duplicates and the lookup indexes are rebuilt;
//   - up fails loudly with more than one school and changes nothing;
//   - down restores the columns backfilled from the one school, the old keys,
//     the two tables (empty), the function and the defaults;
//   - down refuses (and changes nothing) when rows exist but no school does;
//   - up -> down -> up keeps every row.
const SCRATCH_DB = 'edu_single_school_contract';

const SCHOOL = '11111111-1111-4111-8111-111111111111';
const OTHER_SCHOOL = '22222222-2222-4222-8222-222222222222';
const TEACHER = 'aaaaaaa1-0000-4000-8000-000000000001';
const PARENT = 'aaaaaaa1-0000-4000-8000-000000000002';
const CLASSROOM = 'ccccccc1-0000-4000-8000-000000000001';
const PERIOD = 'ddddddd1-0000-4000-8000-000000000001';
const STUDENT = 'eeeeeee1-0000-4000-8000-000000000001';
const GUARDIAN = 'fffffff1-0000-4000-8000-000000000001';
const ENROLLMENT = '99999991-0000-4000-8000-000000000001';

const SCOPED_TABLES = [
  'academic_periods',
  'assignments',
  'attendance',
  'audit_logs',
  'classrooms',
  'custom_fields',
  'email_deliveries',
  'enrollments',
  'grades',
  'guardian_user_links',
  'guardians',
  'message_threads',
  'messages',
  'notifications',
  'report_history',
  'school_events',
  'students',
  'teacher_classroom_assignments',
];

// After a down, the two per-school tables are back (empty) with their column.
const WITH_PER_SCHOOL_TABLES = [
  ...SCOPED_TABLES,
  'institution_extensions',
  'institution_feature_flags',
].sort();

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

async function withScratchDatabaseUrl<T>(fn: () => Promise<T>): Promise<T> {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = scratchUrl();

  try {
    return await fn();
  } finally {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  }
}

describe('migration 0015 single school contract', () => {
  const admin = new pg.Client({ connectionString: adminUrl() });
  let scratch: pg.Client | undefined;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    scratch = new pg.Client({ connectionString: scratchUrl() });
    await scratch.connect();
  });

  afterAll(async () => {
    if (scratch) {
      await scratch.end();
    }
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.end();
  }, 60_000);

  function db(): pg.Client {
    if (!scratch) {
      throw new Error('scratch database is not connected');
    }
    return scratch;
  }

  async function appliedCount() {
    const result = await db().query(
      'SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations'
    );
    return (result.rows[0] as { count: number }).count;
  }

  async function count(query: string) {
    const result = await db().query(query);
    return (result.rows[0] as { count: number }).count;
  }

  async function tableExists(table: string) {
    const result = await db().query(
      'SELECT to_regclass($1) IS NOT NULL AS exists',
      [`public.${table}`]
    );
    return (result.rows[0] as { exists: boolean }).exists;
  }

  async function functionExists() {
    const result = await db().query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'single_school_id'
       ) AS exists`
    );
    return (result.rows[0] as { exists: boolean }).exists;
  }

  async function institutionIdColumns() {
    const result = await db().query(
      `SELECT table_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'institution_id'
        ORDER BY table_name`
    );
    return result.rows as {
      table_name: string;
      is_nullable: string;
      column_default: string | null;
    }[];
  }

  async function foreignKeysToInstitutions() {
    const result = await db().query(
      `SELECT conrelid::regclass::text AS table_name
         FROM pg_constraint
        WHERE contype = 'f' AND confrelid = 'public.institutions'::regclass
        ORDER BY 1`
    );
    return result.rows.map((row: { table_name: string }) => row.table_name);
  }

  async function constraintDef(table: string, name: string) {
    const result = await db().query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = $1::regclass AND conname = $2`,
      [`public.${table}`, name]
    );
    return (result.rows[0] as { def: string } | undefined)?.def ?? null;
  }

  async function indexDef(name: string) {
    const result = await db().query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
      [name]
    );
    return (result.rows[0] as { indexdef: string } | undefined)?.indexdef ?? null;
  }

  async function indexesNamingInstitution() {
    const result = await db().query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexdef ILIKE '%institution_id%'`
    );
    return result.rows;
  }

  async function seedRows() {
    await db().query(
      `INSERT INTO users (id, email, password_hash) VALUES
         ($1, 'teacher@contract.test', 'h'),
         ($2, 'parent@contract.test', 'h')`,
      [TEACHER, PARENT]
    );
    await db().query(
      `INSERT INTO classrooms (id, grade_level, section) VALUES ($1, 5, 'A')`,
      [CLASSROOM]
    );
    await db().query(
      `INSERT INTO academic_periods (id, year, term) VALUES ($1, 2026, 1)`,
      [PERIOD]
    );
    await db().query(
      `INSERT INTO students (id, first_name, last_name) VALUES ($1, 'Ana', 'Contract')`,
      [STUDENT]
    );
    await db().query(
      `INSERT INTO guardians (id, name) VALUES ($1, 'Guardian Contract')`,
      [GUARDIAN]
    );
    await db().query(
      `INSERT INTO guardian_user_links (guardian_id, user_id) VALUES ($1, $2)`,
      [GUARDIAN, PARENT]
    );
    await db().query(
      `INSERT INTO teacher_classroom_assignments (teacher_user_id, classroom_id)
       VALUES ($1, $2)`,
      [TEACHER, CLASSROOM]
    );
    await db().query(
      `INSERT INTO enrollments (id, student_id, academic_period_id, classroom_id)
       VALUES ($1, $2, $3, $4)`,
      [ENROLLMENT, STUDENT, PERIOD, CLASSROOM]
    );
    await db().query(
      `INSERT INTO attendance (enrollment_id, date, status)
       VALUES ($1, '2026-02-02', 'present')`,
      [ENROLLMENT]
    );
  }

  async function seededCounts() {
    return {
      classrooms: await count('SELECT COUNT(*)::int AS count FROM classrooms'),
      periods: await count('SELECT COUNT(*)::int AS count FROM academic_periods'),
      students: await count('SELECT COUNT(*)::int AS count FROM students'),
      links: await count('SELECT COUNT(*)::int AS count FROM guardian_user_links'),
      assignments: await count(
        'SELECT COUNT(*)::int AS count FROM teacher_classroom_assignments'
      ),
      enrollments: await count('SELECT COUNT(*)::int AS count FROM enrollments'),
      attendance: await count('SELECT COUNT(*)::int AS count FROM attendance'),
    };
  }

  const SEEDED = {
    classrooms: 1,
    periods: 1,
    students: 1,
    links: 1,
    assignments: 1,
    enrollments: 1,
    attendance: 1,
  };

  it('is applied by the migrator and leaves no institution_id column anywhere', async () => {
    await withScratchDatabaseUrl(runMigrations);

    expect(await appliedCount()).toBe(16);
    expect(await institutionIdColumns()).toEqual([]);
    expect(await foreignKeysToInstitutions()).toEqual([]);
    expect(await indexesNamingInstitution()).toEqual([]);
  }, 60_000);

  it('drops the two per-school tables and single_school_id(), keeping the configuration row', async () => {
    expect(await tableExists('institution_feature_flags')).toBe(false);
    expect(await tableExists('institution_extensions')).toBe(false);
    expect(await functionExists()).toBe(false);

    expect(await tableExists('institutions')).toBe(true);
    const columns = await db().query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institutions'
        ORDER BY column_name`
    );
    expect(columns.rows.map((row: { column_name: string }) => row.column_name))
      .toEqual(['created_at', 'id', 'name', 'reply_to_email', 'sender_name']);
  });

  it('rebuilds the keys without the school', async () => {
    expect(
      await constraintDef(
        'teacher_classroom_assignments',
        'teacher_classroom_assignments_pk'
      )
    ).toBe('PRIMARY KEY (teacher_user_id, classroom_id)');
    expect(
      await constraintDef('guardian_user_links', 'guardian_user_links_pk')
    ).toBe('PRIMARY KEY (guardian_id, user_id)');
    expect(
      await constraintDef('academic_periods', 'academic_periods_year_term_unique')
    ).toBe('UNIQUE (year, term)');
    expect(
      await constraintDef('classrooms', 'classrooms_grade_level_section_unique')
    ).toBe('UNIQUE (grade_level, section)');
  });

  it.each([
    ['guardian_user_links_user_idx', '(user_id)'],
    ['teacher_classroom_assignments_teacher_idx', '(teacher_user_id)'],
    ['assignments_due_idx', '(due_date)'],
    ['school_events_starts_idx', '(starts_at)'],
    ['messages_recipient_idx', '(recipient_user_id, read_at)'],
    ['report_history_student_idx', '(student_id, created_at)'],
    ['email_deliveries_created_idx', '(created_at DESC, id DESC)'],
    [
      'email_deliveries_inflight_idx',
      "(updated_at) WHERE (status = ANY (ARRAY['queued'::text, 'sending'::text, 'retried'::text]))",
    ],
  ])('recreates the lookup index %s on %s', async (name, columns) => {
    const def = await indexDef(name);
    expect(def).not.toBeNull();
    expect(def).toContain(`USING btree ${columns}`);
  });

  it('accepts rows without any school and rejects duplicates on the new keys', async () => {
    expect(await count('SELECT COUNT(*)::int AS count FROM institutions')).toBe(0);
    await seedRows();

    await expect(
      db().query(
        `INSERT INTO teacher_classroom_assignments (teacher_user_id, classroom_id)
         VALUES ($1, $2)`,
        [TEACHER, CLASSROOM]
      )
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db().query(
        `INSERT INTO guardian_user_links (guardian_id, user_id) VALUES ($1, $2)`,
        [GUARDIAN, PARENT]
      )
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db().query(`INSERT INTO academic_periods (year, term) VALUES (2026, 1)`)
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db().query(`INSERT INTO classrooms (grade_level, section) VALUES (5, 'A')`)
    ).rejects.toMatchObject({ code: '23505' });

    expect(await seededCounts()).toEqual(SEEDED);
  });

  it('down refuses and changes nothing when rows exist but there is no school', async () => {
    await expect(withScratchDatabaseUrl(runMigrationsDown)).rejects.toThrow(
      /no institutions row/
    );

    expect(await appliedCount()).toBe(16);
    expect(await institutionIdColumns()).toEqual([]);
    expect(await tableExists('institution_feature_flags')).toBe(false);
    expect(await seededCounts()).toEqual(SEEDED);
  }, 60_000);

  it('down restores the columns backfilled from the one school, the old keys, the tables and the function', async () => {
    await db().query(
      `INSERT INTO institutions (id, name) VALUES ($1, 'The School')`,
      [SCHOOL]
    );

    await withScratchDatabaseUrl(runMigrationsDown);

    expect(await appliedCount()).toBe(15);
    const columns = await institutionIdColumns();
    expect(columns.map((c) => c.table_name)).toEqual(WITH_PER_SCHOOL_TABLES);
    expect(columns.every((c) => c.is_nullable === 'NO')).toBe(true);
    expect(
      columns
        .filter((c) => c.column_default === 'single_school_id()')
        .map((c) => c.table_name)
    ).toEqual(SCOPED_TABLES);
    expect(await foreignKeysToInstitutions()).toEqual(WITH_PER_SCHOOL_TABLES);
    expect(await functionExists()).toBe(true);

    for (const table of SCOPED_TABLES) {
      expect(
        await count(
          `SELECT COUNT(*)::int AS count FROM ${table}
            WHERE institution_id IS DISTINCT FROM '${SCHOOL}'`
        )
      ).toBe(0);
    }
    expect(await seededCounts()).toEqual(SEEDED);

    expect(await tableExists('institution_feature_flags')).toBe(true);
    expect(await tableExists('institution_extensions')).toBe(true);
    expect(
      await count('SELECT COUNT(*)::int AS count FROM institution_feature_flags')
    ).toBe(0);

    expect(
      await constraintDef(
        'teacher_classroom_assignments',
        'teacher_classroom_assignments_pk'
      )
    ).toBe('PRIMARY KEY (institution_id, teacher_user_id, classroom_id)');
    expect(
      await constraintDef('guardian_user_links', 'guardian_user_links_pk')
    ).toBe('PRIMARY KEY (institution_id, guardian_id, user_id)');
    expect(
      await constraintDef(
        'academic_periods',
        'academic_periods_institution_id_year_term_unique'
      )
    ).toBe('UNIQUE (institution_id, year, term)');
    expect(
      await constraintDef(
        'classrooms',
        'classrooms_institution_id_grade_level_section_unique'
      )
    ).toBe('UNIQUE (institution_id, grade_level, section)');
    expect(await indexDef('email_deliveries_institution_created_idx')).toContain(
      '(institution_id, created_at DESC, id DESC)'
    );
    expect(await indexDef('assignments_institution_due_idx')).toContain(
      '(institution_id, due_date)'
    );
    expect(await indexDef('assignments_due_idx')).toBeNull();

    // The 0014 state again: an insert that omits the column gets the school.
    const student = await db().query(
      `INSERT INTO students (first_name, last_name) VALUES ('After', 'Down')
       RETURNING institution_id`
    );
    expect(student.rows).toEqual([{ institution_id: SCHOOL }]);
    await db().query(`DELETE FROM students WHERE first_name = 'After'`);
  }, 60_000);

  it('up fails loudly with more than one school and changes nothing', async () => {
    await db().query(
      `INSERT INTO institutions (id, name) VALUES ($1, 'Second School')`,
      [OTHER_SCHOOL]
    );

    await expect(withScratchDatabaseUrl(runMigrations)).rejects.toThrow();

    expect(await appliedCount()).toBe(15);
    expect(await institutionIdColumns()).toHaveLength(
      WITH_PER_SCHOOL_TABLES.length
    );
    expect(await tableExists('institution_feature_flags')).toBe(true);
    expect(await functionExists()).toBe(true);
  }, 60_000);

  it('up -> down -> up is stable and keeps every row', async () => {
    await db().query('DELETE FROM institutions WHERE id = $1', [OTHER_SCHOOL]);

    await withScratchDatabaseUrl(runMigrations);
    expect(await appliedCount()).toBe(16);
    expect(await institutionIdColumns()).toEqual([]);
    expect(await seededCounts()).toEqual(SEEDED);

    await withScratchDatabaseUrl(runMigrationsDown);
    expect(await appliedCount()).toBe(15);
    expect(await seededCounts()).toEqual(SEEDED);

    await withScratchDatabaseUrl(runMigrations);
    expect(await appliedCount()).toBe(16);
    expect(await institutionIdColumns()).toEqual([]);
    expect(await foreignKeysToInstitutions()).toEqual([]);
    expect(await seededCounts()).toEqual(SEEDED);

    const school = await db().query('SELECT id, name FROM institutions');
    expect(school.rows).toEqual([{ id: SCHOOL, name: 'The School' }]);
  }, 90_000);
});
