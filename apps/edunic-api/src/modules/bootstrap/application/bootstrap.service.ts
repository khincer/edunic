import { execSync } from 'node:child_process';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export class BootstrapServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'BootstrapServiceError';
  }
}

export class BootstrapService {
  async runBootstrap() {
    const startedAt = Date.now();

    try {
      await this.runMigrations();
    } catch (error) {
      throw new BootstrapServiceError(
        this.toStageMessage('migration', error),
        500
      );
    }

    try {
      this.runCommand('npx tsx tools/seed.ts');
    } catch (error) {
      throw new BootstrapServiceError(
        this.toStageMessage('seed', error),
        500
      );
    }

    return {
      data: {
        migration: 'ok',
        seed: 'ok',
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private toStageMessage(stage: 'migration' | 'seed', error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return `Bootstrap failed during ${stage}: ${detail}`;
  }

  private runCommand(command: string) {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env },
    });
  }

  private async runMigrations() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    const pool = new pg.Pool({
      connectionString: databaseUrl,
    });
    const db = drizzle(pool);

    try {
      await migrate(db, {
        migrationsFolder: 'libs/db/src/migrations',
      });
    } finally {
      await pool.end();
    }
  }
}
