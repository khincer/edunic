import { readFileSync } from 'node:fs';
import pg from 'pg';

const MIGRATIONS_FOLDER = 'libs/db/src/migrations';
const MIGRATIONS_TABLE = 'drizzle.__drizzle_migrations';

type Journal = { entries: { tag: string }[] };

// Mirrors the bookkeeping drizzle-orm's migrator maintains
// (drizzle.__drizzle_migrations, journal order) but walks the chain backwards:
// one step rolls back the last applied journal entry by running its sibling
// .down.sql, then de-records it so a later `migrate` re-applies it.
export async function runMigrationsDown(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const journal = JSON.parse(
      readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8')
    ) as Journal;

    const table = await client.query<{ name: string | null }>(
      'SELECT to_regclass($1) AS name',
      [MIGRATIONS_TABLE]
    );

    if (table.rows[0].name === null) {
      throw new Error('No migrations to roll back');
    }

    const applied = await client.query<{ id: number }>(
      `SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`
    );

    if (applied.rows.length === 0) {
      throw new Error('No migrations to roll back');
    }

    if (applied.rows.length > journal.entries.length) {
      throw new Error(
        `Applied migration count (${applied.rows.length}) exceeds the journal length (${journal.entries.length}); refusing to roll back`
      );
    }

    // Rows are recorded in application order, so the Nth applied row maps to
    // the Nth journal entry — never edit an applied up file; add a migration.
    const entry = journal.entries[applied.rows.length - 1];
    const downSql = readFileSync(
      `${MIGRATIONS_FOLDER}/${entry.tag}.down.sql`,
      'utf8'
    );

    for (const statement of downSql.split('--> statement-breakpoint')) {
      await client.query(statement);
    }

    await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE id = $1`, [
      applied.rows[applied.rows.length - 1].id,
    ]);
  } finally {
    await client.end();
  }
}
