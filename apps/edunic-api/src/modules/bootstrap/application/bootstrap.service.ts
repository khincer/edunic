import { execSync } from 'node:child_process';

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
      this.runCommand(
        'npx drizzle-kit migrate --config=libs/db/src/drizzle.config.ts'
      );
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
    });
  }
}
