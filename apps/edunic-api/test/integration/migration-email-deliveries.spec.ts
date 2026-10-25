import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { db, runMigrations } from '@edunic/source/db';
import { ensureTestDatabaseReady, resetTestDatabase } from '../helpers/db.js';

const MIGRATIONS_DIR = 'libs/db/src/migrations';

// The down/up test re-applies 0010, which merges every school into one and
// repoints their rows. Suites truncate when they start, not when they end, so
// the previous suite's school and students are still here; when this suite's
// school wins the merge, those students move onto it and afterAll cannot
// delete it. Start from an empty database so the merge only sees our rows.
beforeAll(async () => {
  await ensureTestDatabaseReady();
  await resetTestDatabase();
});

// Rows created by this suite; deleted in afterAll so the shared test database is
// handed back the way it was found.
const createdInstitutions: string[] = [];

async function columnExists(table: string, column: string) {
  const result = await db.execute(sql`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = ${table} and column_name = ${column}
    ) as exists
  `);
  return (result.rows[0] as { exists: boolean }).exists;
}

async function tableName(table: string) {
  const result = await db.execute(
    sql.raw(`SELECT to_regclass('${table}') AS name`)
  );
  return (result.rows[0] as { name: string | null }).name;
}

async function indexNames(table: string) {
  const result = await db.execute(sql`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = ${table}
  `);
  return (result.rows as { indexname: string }[]).map((row) => row.indexname);
}

async function emailFlagDefault() {
  const result = await db.execute(sql`
    select default_value from feature_flags where key = 'email_notifications'
  `);
  const row = result.rows[0] as { default_value: boolean } | undefined;
  return row === undefined ? null : row.default_value;
}

async function createInstitution(name: string) {
  const id = randomUUID();
  createdInstitutions.push(id);
  await db.execute(
    sql`insert into institutions (id, name) values (${id}, ${name})`
  );
  return id;
}

afterAll(async () => {
  for (const id of createdInstitutions) {
    await db.execute(
      sql`delete from email_deliveries where institution_id = ${id}`
    );
    await db.execute(sql`delete from guardians where institution_id = ${id}`);
    await db.execute(sql`delete from institutions where id = ${id}`);
  }
});

describe('migration 0007 email notifications (D4, D7)', () => {
  beforeAll(async () => {
    await ensureTestDatabaseReady();
  });

  it('up applies: email columns exist, blank strings are rejected, the flag defaults false', async () => {
    expect(await columnExists('guardians', 'email')).toBe(true);
    expect(await columnExists('institutions', 'sender_name')).toBe(true);
    expect(await columnExists('institutions', 'reply_to_email')).toBe(true);
    expect(await emailFlagDefault()).toBe(false);

    const institutionId = await createInstitution('Migration 0007');

    // NULL and '' both mean "no email"; a blank string must not be storable.
    const guardianId = randomUUID();
    await db.execute(
      sql`insert into guardians (id, institution_id, name)
          values (${guardianId}, ${institutionId}, 'Guardian')`
    );
    await db.execute(
      sql`update guardians set email = ${'family@example.com'}
          where id = ${guardianId}`
    );
    const stored = await db.execute(
      sql`select email from guardians where id = ${guardianId}`
    );
    expect((stored.rows[0] as { email: string }).email).toBe(
      'family@example.com'
    );

    await expect(
      db.execute(sql`update guardians set email = '' where id = ${guardianId}`)
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.execute(sql`update guardians set email = '   ' where id = ${guardianId}`)
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    // Sender identity follows the same blank-string rule.
    await db.execute(
      sql`update institutions
          set sender_name = ${'Colegio Norte'}, reply_to_email = ${'hola@colegio.test'}
          where id = ${institutionId}`
    );
    const sender = await db.execute(
      sql`select sender_name, reply_to_email from institutions where id = ${institutionId}`
    );
    expect(sender.rows[0]).toMatchObject({
      sender_name: 'Colegio Norte',
      reply_to_email: 'hola@colegio.test',
    });

    await expect(
      db.execute(
        sql`update institutions set sender_name = '' where id = ${institutionId}`
      )
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.execute(
        sql`update institutions set reply_to_email = ' ' where id = ${institutionId}`
      )
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });
});

describe('migration 0008 email_deliveries (D4)', () => {
  beforeAll(async () => {
    await ensureTestDatabaseReady();
  });

  it('up applies: the ledger stores a valid attempt and rejects bad rows', async () => {
    expect(await tableName('email_deliveries')).toBe('email_deliveries');
    expect((await indexNames('email_deliveries')).sort()).toEqual(
      [
        'email_deliveries_pkey',
        'email_deliveries_inflight_idx',
        'email_deliveries_institution_created_idx',
        // The institution-free idempotency key, installed by migration 0010.
        'email_deliveries_event_id_recipient_address_unique',
      ].sort()
    );

    const institutionId = await createInstitution('Migration 0008');
    const eventId = randomUUID();

    await db.execute(
      sql`insert into email_deliveries
            (institution_id, event_id, event_name, recipient_address, recipient_source)
          values (${institutionId}, ${eventId}, ${'enrollment.welcomed'},
                  ${'family@example.com'}, ${'guardian'})`
    );

    const stored = await db.execute(
      sql`select status, attempt_count, provider_message_id, provider_error, sent_at, student_id
          from email_deliveries
          where institution_id = ${institutionId} and event_id = ${eventId}`
    );
    expect(stored.rows[0]).toMatchObject({
      status: 'queued',
      attempt_count: 0,
      provider_message_id: null,
      provider_error: null,
      sent_at: null,
      student_id: null,
    });

    // Unknown status.
    await expect(
      db.execute(
        sql`insert into email_deliveries
              (institution_id, event_id, event_name, recipient_address, recipient_source, status)
            values (${institutionId}, ${randomUUID()}, ${'grade.submitted'},
                    ${'other@example.com'}, ${'guardian'}, ${'bogus'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    // Unknown recipient source.
    await expect(
      db.execute(
        sql`insert into email_deliveries
              (institution_id, event_id, event_name, recipient_address, recipient_source)
            values (${institutionId}, ${randomUUID()}, ${'grade.submitted'},
                    ${'other@example.com'}, ${'other'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    // Duplicate (institution, event, address): the idempotency key.
    await expect(
      db.execute(
        sql`insert into email_deliveries
              (institution_id, event_id, event_name, recipient_address, recipient_source)
            values (${institutionId}, ${eventId}, ${'enrollment.welcomed'},
                    ${'family@example.com'}, ${'guardian'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23505' } });

    // Tenant FK.
    await expect(
      db.execute(
        sql`insert into email_deliveries
              (institution_id, event_id, event_name, recipient_address, recipient_source)
            values (${randomUUID()}, ${randomUUID()}, ${'grade.submitted'},
                    ${'nowhere@example.com'}, ${'user'})`
      )
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('down reverses 0008 then 0007 and up re-applies both cleanly', async () => {
    // 0011 comes off first: it dropped the free-text subject that 0010's
    // backfill reads.
    await db.execute(
      sql.raw(
        readFileSync(
          `${MIGRATIONS_DIR}/0011_single_school_subjects.down.sql`,
          'utf8'
        )
      )
    );

    await db.execute(
      sql.raw(
        readFileSync(
          `${MIGRATIONS_DIR}/0008_email_deliveries.down.sql`,
          'utf8'
        )
      )
    );
    expect(await tableName('email_deliveries')).toBeNull();
    expect(await columnExists('guardians', 'email')).toBe(true);

    await db.execute(
      sql.raw(
        readFileSync(
          `${MIGRATIONS_DIR}/0007_email_notifications.down.sql`,
          'utf8'
        )
      )
    );
    expect(await columnExists('guardians', 'email')).toBe(false);
    expect(await columnExists('institutions', 'sender_name')).toBe(false);
    expect(await columnExists('institutions', 'reply_to_email')).toBe(false);
    expect(await emailFlagDefault()).toBeNull();

    await db.execute(
      sql.raw(readFileSync(`${MIGRATIONS_DIR}/0007_email_notifications.sql`, 'utf8'))
    );
    await db.execute(
      sql.raw(readFileSync(`${MIGRATIONS_DIR}/0008_email_deliveries.sql`, 'utf8'))
    );

    // 0009 and 0010 come after 0008 in the chain. 0008's up recreates the
    // ledger with its institution-scoped unique key, so the later migrations
    // are re-applied here — otherwise the database would end up disagreeing
    // with the applied migration list.
    await db.execute(
      sql.raw(
        readFileSync(`${MIGRATIONS_DIR}/0009_single_school_expand.sql`, 'utf8')
      )
    );
    await db.execute(
      sql.raw(
        readFileSync(`${MIGRATIONS_DIR}/0010_single_school_merge.sql`, 'utf8')
      )
    );
    await db.execute(
      sql.raw(
        readFileSync(
          `${MIGRATIONS_DIR}/0011_single_school_subjects.sql`,
          'utf8'
        )
      )
    );

    expect(await tableName('email_deliveries')).toBe('email_deliveries');
    expect(await columnExists('guardians', 'email')).toBe(true);
    expect(await emailFlagDefault()).toBe(false);

    // The migrator journal stays consistent: a re-run is a no-op, not an error.
    await expect(runMigrations()).resolves.toBeUndefined();
  }, 60_000);
});
