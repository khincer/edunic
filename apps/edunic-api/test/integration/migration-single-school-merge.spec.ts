import pg from 'pg';
import { runMigrations, runMigrationsDown } from '@edunic/source/db';

// The institution merge is the one migration whose effect cannot be replayed
// from a journal entry alone: it moves rows between schools. The proof is
// therefore run on a scratch database — migrate up, roll the merge back,
// seed two schools with data that COLLIDES on every unique key, migrate up
// again, and assert nothing was lost.
const SCRATCH_DB = 'edu_single_school_merge';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

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

describe('migration 0010 single school merge', () => {
  const admin = new pg.Client({ connectionString: adminUrl() });
  let scratch: pg.Client | undefined;

  beforeAll(async () => {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    scratch = new pg.Client({ connectionString: scratchUrl() });
    await scratch.connect();

    // Migrate up, then roll the merge back so the seed data below lands on
    // the pre-merge schema.
    await withScratchDatabaseUrl(runMigrations);
    // 0014, 0013, 0012, 0011 and the merge come off in order.
    await withScratchDatabaseUrl(runMigrationsDown);
    await withScratchDatabaseUrl(runMigrationsDown);
    await withScratchDatabaseUrl(runMigrationsDown);
    await withScratchDatabaseUrl(runMigrationsDown);
    await withScratchDatabaseUrl(runMigrationsDown);
  }, 120_000);

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

  async function seedTwoSchools() {
    await db().query(
      `insert into institutions (id, name, sender_name, reply_to_email) values
         ($1, 'School A', 'School A Sender', 'a@example.com'),
         ($2, 'School B', 'School B Sender', 'b@example.com')`,
      [A, B]
    );

    await db().query(
      `insert into users (id, email, password_hash) values
         ('aaaaaaa1-0000-4000-8000-000000000001', 'a1@example.com', 'h'),
         ('aaaaaaa1-0000-4000-8000-000000000002', 'a2@example.com', 'h'),
         ('bbbbbbb1-0000-4000-8000-000000000001', 'b1@example.com', 'h'),
         ('bbbbbbb1-0000-4000-8000-000000000002', 'both@example.com', 'h')`
    );

    // The last user holds a role in BOTH schools: the merge keeps one role
    // per user, and the row with the lowest id wins.
    await db().query(
      `insert into user_institution_roles (id, user_id, institution_id, role) values
         ('00000001-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000001', $1, 'admin'),
         ('00000001-0000-4000-8000-000000000002', 'aaaaaaa1-0000-4000-8000-000000000002', $1, 'teacher'),
         ('00000001-0000-4000-8000-000000000003', 'bbbbbbb1-0000-4000-8000-000000000001', $2, 'teacher'),
         ('00000001-0000-4000-8000-000000000004', 'bbbbbbb1-0000-4000-8000-000000000002', $2, 'admin'),
         ('00000001-0000-4000-8000-000000000005', 'bbbbbbb1-0000-4000-8000-000000000002', $1, 'parent')`,
      [A, B]
    );

    // Both schools have a classroom for grade 5 'A' — a duplicate once the
    // institutions merge. Both also have academic period 2026/1.
    await db().query(
      `insert into classrooms (id, institution_id, grade_level, section) values
         ('ccccccc1-0000-4000-8000-000000000001', $1, 5, 'A'),
         ('ccccccc1-0000-4000-8000-000000000002', $2, 5, 'A'),
         ('ccccccc1-0000-4000-8000-000000000003', $2, 6, 'B')`,
      [A, B]
    );

    await db().query(
      `insert into academic_periods (id, institution_id, year, term) values
         ('dddddddd-0000-4000-8000-000000000001', $1, 2026, 1),
         ('dddddddd-0000-4000-8000-000000000002', $2, 2026, 1)`,
      [A, B]
    );

    await db().query(
      `insert into students (id, institution_id, first_name, last_name) values
         ('eeeeeeee-0000-4000-8000-000000000001', $1, 'Ana', 'Sur'),
         ('eeeeeeee-0000-4000-8000-000000000002', $2, 'Beto', 'Norte')`,
      [A, B]
    );

    await db().query(
      `insert into enrollments (id, institution_id, student_id, academic_period_id, classroom_id) values
         ('ffffffff-0000-4000-8000-000000000001', $1,
          'eeeeeeee-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001',
          'ccccccc1-0000-4000-8000-000000000001'),
         ('ffffffff-0000-4000-8000-000000000002', $2,
          'eeeeeeee-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000002',
          'ccccccc1-0000-4000-8000-000000000002')`,
      [A, B]
    );

    await db().query(
      `insert into grades (id, institution_id, enrollment_id, subject, score) values
         ('99999999-0000-4000-8000-000000000001', $1,
          'ffffffff-0000-4000-8000-000000000001', 'History', 80),
         ('99999999-0000-4000-8000-000000000002', $2,
          'ffffffff-0000-4000-8000-000000000002', 'Mathematics', 95)`,
      [A, B]
    );

    // The same guardian and the same teacher appear in both schools, so both
    // tables collide once the institutions merge.
    // The same guardian is linked to the same user from both schools, so the
    // link table collides once the institutions merge.
    await db().query(
      `insert into guardians (id, institution_id, name) values
         ('77777777-0000-4000-8000-000000000001', $1, 'Guardian')`,
      [A]
    );

    await db().query(
      `insert into guardian_user_links (institution_id, guardian_id, user_id) values
         ($1, '77777777-0000-4000-8000-000000000001', 'bbbbbbb1-0000-4000-8000-000000000002'),
         ($2, '77777777-0000-4000-8000-000000000001', 'bbbbbbb1-0000-4000-8000-000000000002')`,
      [A, B]
    );

    await db().query(
      `insert into teacher_classroom_assignments (institution_id, teacher_user_id, classroom_id) values
         ($1, 'bbbbbbb1-0000-4000-8000-000000000002', 'ccccccc1-0000-4000-8000-000000000001'),
         ($2, 'bbbbbbb1-0000-4000-8000-000000000002', 'ccccccc1-0000-4000-8000-000000000002')`,
      [A, B]
    );

    await db().query(
      `insert into institution_feature_flags (institution_id, feature_key, enabled) values
         ($1, 'email_notifications', true),
         ($2, 'email_notifications', false)`,
      [A, B]
    );

    await db().query(
      `insert into extensions (key, name) values ('notifications', 'Notifications')
        on conflict (key) do nothing`
    );

    await db().query(
      `insert into institution_extensions (institution_id, extension_key) values
         ($1, 'notifications'),
         ($2, 'notifications')`,
      [A, B]
    );
  }

  it('merges the schools without losing a row', async () => {
    await seedTwoSchools();
    await withScratchDatabaseUrl(runMigrations);

    // One school survives, and it keeps its sender identity.
    const institutions = await db().query(
      'select id, name, sender_name, reply_to_email from institutions'
    );
    expect(institutions.rows).toEqual([
      {
        id: A,
        name: 'School A',
        sender_name: 'School A Sender',
        reply_to_email: 'a@example.com',
      },
    ]);

    // The other school's rows are repointed, not deleted.
    const students = await db().query(
      'select id, institution_id from students order by id'
    );
    expect(students.rows).toEqual([
      { id: 'eeeeeeee-0000-4000-8000-000000000001', institution_id: A },
      { id: 'eeeeeeee-0000-4000-8000-000000000002', institution_id: A },
    ]);

    const grades = await db().query(
      'select g.id, g.institution_id, s.name as subject from grades g join subjects s on s.id = g.subject_id order by g.id'
    );
    expect(grades.rows.every((row) => row.institution_id === A)).toBe(true);
    expect(grades.rows).toHaveLength(2);
  }, 120_000);

  it('resolves the unique keys that the merge would collide on', async () => {
    // One classroom for grade 5 'A' survives; the unique one is untouched.
    const classrooms = await db().query(
      'select id, institution_id, grade_level, section from classrooms order by grade_level'
    );
    expect(classrooms.rows).toEqual([
      {
        id: 'ccccccc1-0000-4000-8000-000000000001',
        institution_id: A,
        grade_level: 5,
        section: 'A',
      },
      {
        id: 'ccccccc1-0000-4000-8000-000000000003',
        institution_id: A,
        grade_level: 6,
        section: 'B',
      },
    ]);

    // The enrollment follows the surviving classroom and academic period.
    const enrollment = await db().query(
      `select classroom_id, academic_period_id, institution_id from enrollments
        where id = 'ffffffff-0000-4000-8000-000000000002'`
    );
    expect(enrollment.rows[0]).toEqual({
      classroom_id: 'ccccccc1-0000-4000-8000-000000000001',
      academic_period_id: 'dddddddd-0000-4000-8000-000000000001',
      institution_id: A,
    });

    // One teacher assignment and one guardian link survive per pair.
    const assignments = await db().query(
      `select teacher_user_id, classroom_id from teacher_classroom_assignments
        where teacher_user_id = 'bbbbbbb1-0000-4000-8000-000000000002'`
    );
    expect(assignments.rows).toHaveLength(1);
    expect(assignments.rows[0].classroom_id).toBe(
      'ccccccc1-0000-4000-8000-000000000001'
    );

    const links = await db().query(
      `select guardian_id, user_id from guardian_user_links
        where user_id = 'bbbbbbb1-0000-4000-8000-000000000002'`
    );
    expect(links.rows).toHaveLength(1);

    // The surviving school's per-school flag wins.
    const flags = await db().query(
      `select feature_key, enabled from institution_feature_flags
        where feature_key = 'email_notifications'`
    );
    expect(flags.rows).toEqual([
      { feature_key: 'email_notifications', enabled: true },
    ]);

    const extensions = await db().query(
      `select extension_key from institution_extensions where extension_key = 'notifications'`
    );
    expect(extensions.rows).toHaveLength(1);
  });

  it('backfills one role per user and a materia per grade subject', async () => {
    const roles = await db().query(
      'select user_id, role from user_roles order by user_id'
    );
    // 0010 backfills 'admin'; 0013, applied after it, renames it to 'director'.
    expect(roles.rows).toEqual([
      { user_id: 'aaaaaaa1-0000-4000-8000-000000000001', role: 'director' },
      { user_id: 'aaaaaaa1-0000-4000-8000-000000000002', role: 'teacher' },
      // The role row with the lowest id wins, so the shared user keeps the
      // administrative role.
      { user_id: 'bbbbbbb1-0000-4000-8000-000000000001', role: 'teacher' },
      { user_id: 'bbbbbbb1-0000-4000-8000-000000000002', role: 'director' },
    ]);

    const subjects = await db().query(
      'select name from subjects order by name'
    );
    expect(subjects.rows).toEqual([
      { name: 'History' },
      { name: 'Mathematics' },
    ]);

    const grades = await db().query(
      `select s.name as subject_name
        from grades g join subjects s on s.id = g.subject_id
        order by s.name`
    );
    expect(grades.rows).toEqual([
      { subject_name: 'History' },
      { subject_name: 'Mathematics' },
    ]);
  });

  it('replaces the email idempotency key with the institution-free one', async () => {
    const indexes = await db().query(
      `select indexname from pg_indexes
        where schemaname = 'public' and tablename = 'email_deliveries'`
    );
    const names = indexes.rows.map((row) => row.indexname);
    expect(names).toContain('email_deliveries_event_id_recipient_address_unique');
    expect(names).not.toContain(
      'email_deliveries_institution_event_recipient_unique'
    );

    const constraints = await db().query(
      `select conname from pg_constraint
        where conrelid = 'email_deliveries'::regclass and contype = 'u'`
    );
    expect(constraints.rows.map((row: { conname: string }) => row.conname)).toEqual(
      ['email_deliveries_event_id_recipient_address_unique']
    );
  });
});
