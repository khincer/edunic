type ErrorWithCause = Error & {
  cause?: unknown;
};

type PostgresErrorLike = {
  code?: string;
  constraint?: string;
  detail?: string;
  message?: string;
  table?: string;
};

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export type CliOption = {
  name: string;
  description: string;
};

export function parseFlags(
  argv: string[],
  options: CliOption[],
): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  const validNames = new Set(options.map((o) => o.name));

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new CliError(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);

    if (!validNames.has(key)) {
      if (options.length === 0) {
        throw new CliError(`Unknown option: --${key}. This command takes no options.`);
      }
      const available = options.map((o) => `--${o.name}`).join(', ');
      throw new CliError(`Unknown option: --${key}. Available options: ${available}`);
    }

    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new CliError(`Missing value for --${key}.`);
    }

    index += 1;

    result[key] = value;
  }

  return result;
}

export function requireEnv(name: string, hint?: string): string {
  const value = process.env[name];

  if (!value) {
    const base = `${name} is not set. Set it in the root .env file, e.g. '${name}=postgres://user:pass@localhost:5432/edunic'.`;
    throw new CliError(hint ? `${base} ${hint}` : base);
  }

  return value;
}

export function renderHelp(
  title: string,
  usage: string[],
  options: CliOption[],
): void {
  const lines = [title, '', 'Usage:'];

  for (const line of usage) {
    lines.push(`  ${line}`);
  }

  if (options.length > 0) {
    lines.push('', 'Options:');
    for (const opt of options) {
      const padded = opt.name.padEnd(18);
      lines.push(`  ${padded}${opt.description}`);
    }
  }

  lines.push('');
  console.log(lines.join('\n'));
}

export function getCliErrorMessage(error: unknown): string {
  const cause = getRootCause(error);
  const postgresError = getPostgresError(cause);

  if (postgresError?.code === '42P01') {
    return [
      'Database schema is missing or not migrated.',
      'Run: npm run db:migrate',
      'Then seed local institutions if needed: npm run db:seed',
      `Original database error: ${postgresError.message ?? 'relation does not exist'}`,
    ].join('\n');
  }

  if (postgresError?.code === '28P01') {
    return 'Database authentication failed. Check DATABASE_URL credentials.';
  }

  if (postgresError?.code === '3D000') {
    return 'Database does not exist. Check DATABASE_URL or create the database before running this command.';
  }

  if (postgresError?.code === '23505') {
    return `Database unique constraint failed${postgresError.constraint ? `: ${postgresError.constraint}` : ''}.`;
  }

  if (postgresError?.code === '23503') {
    return `Database foreign key constraint failed${postgresError.constraint ? `: ${postgresError.constraint}` : ''}.`;
  }

  if (postgresError?.code === 'ECONNREFUSED') {
    return 'Could not connect to the database. Check that Postgres is running and DATABASE_URL points to it.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getRootCause(error: unknown): unknown {
  let current = error;

  while (current instanceof Error && 'cause' in current) {
    const cause = (current as ErrorWithCause).cause;

    if (!cause || cause === current) {
      break;
    }

    current = cause;
  }

  return current;
}

function getPostgresError(error: unknown): PostgresErrorLike | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const value = error as PostgresErrorLike;

  if (typeof value.code === 'string') {
    return value;
  }

  return null;
}
