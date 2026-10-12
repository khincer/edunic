import { runMigrations } from '@edunic/source/db';

describe('runMigrations', () => {
  it('rejects with a clear error when DATABASE_URL is absent', async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(runMigrations()).rejects.toThrow('DATABASE_URL is not set');
    } finally {
      if (previous !== undefined) {
        process.env.DATABASE_URL = previous;
      }
    }
  });

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  // Happy path needs a live Postgres; the API integration suite also
  // exercises it via ensureTestDatabaseReady. Skipped when no DB is wired.
  (hasDatabaseUrl ? it : it.skip)(
    'applies migrations against the configured store without error',
    async () => {
      await expect(runMigrations()).resolves.toBeUndefined();
    }
  );
});