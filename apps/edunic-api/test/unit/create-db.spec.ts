import { createDb } from '@edunic/source/db';

describe('createDb', () => {
  it('throws a clear error when no URL is provided and DATABASE_URL is absent', () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => createDb()).toThrow('DATABASE_URL is not set');
    } finally {
      if (previous !== undefined) {
        process.env.DATABASE_URL = previous;
      }
    }
  });

  it('uses the provided URL and defaults allowExitOnIdle to true under jest', () => {
    const { pool } = createDb({
      databaseUrl: 'postgres://user:pass@localhost:5432/unit-test',
    });
    expect(pool.options.connectionString).toBe(
      'postgres://user:pass@localhost:5432/unit-test'
    );
    expect(pool.options.allowExitOnIdle).toBe(true);
  });

  it('honours an explicit allowExitOnIdle override', () => {
    const { pool } = createDb({
      databaseUrl: 'postgres://user:pass@localhost:5432/unit-test',
      allowExitOnIdle: false,
    });
    expect(pool.options.allowExitOnIdle).toBe(false);
  });

  it('returns a db handle wired to the schema', async () => {
    const { db } = createDb({
      databaseUrl: 'postgres://user:pass@localhost:5432/unit-test',
    });
    expect(typeof db.select).toBe('function');
  });
});