import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const MIGRATIONS_FOLDER = 'libs/db/src/migrations';

type Journal = { entries: { tag: string }[] };

// Applies the migration chain up to and including `lastTag`, with the same
// drizzle migrator and bookkeeping as runMigrations, against DATABASE_URL.
// Specs about an older migration replay the schema as it stood then (the 0014
// specs still see the school column); a later runMigrations applies the rest.
export async function runMigrationsUpTo(lastTag: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const journal = JSON.parse(
    readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8')
  ) as Journal;
  const last = journal.entries.findIndex((entry) => entry.tag === lastTag);

  if (last === -1) {
    throw new Error(`Unknown migration ${lastTag}`);
  }

  const folder = mkdtempSync(join(tmpdir(), 'edunic-migrations-'));
  const entries = journal.entries.slice(0, last + 1);
  mkdirSync(join(folder, 'meta'));
  writeFileSync(
    join(folder, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries })
  );
  for (const entry of entries) {
    copyFileSync(
      `${MIGRATIONS_FOLDER}/${entry.tag}.sql`,
      join(folder, `${entry.tag}.sql`)
    );
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
    rmSync(folder, { recursive: true, force: true });
  }
}
