import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../apps/edunic-api/src/modules/auth/application/password.js';
import { db, pool } from '../libs/db/src/index.js';
import {
  institutions,
  userInstitutionRoles,
  users,
} from '../libs/db/src/schema/index.js';
import { resolveTenantFromHost } from '../apps/edunic-fe/src/lib/tenant.js';

const ROLES = ['admin', 'teacher', 'parent'] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Role = (typeof ROLES)[number];

type Args = {
  email?: string;
  host?: string;
  institutionId?: string;
  password?: string;
  role?: string;
};

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const email = requireEmail(args.email);
  const role = requireRole(args.role);
  const institutionId = resolveInstitutionId(args);
  const password = args.password ?? generatePassword();

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const result = await db.transaction(async (tx) => {
    const [institution] = await tx
      .select({ id: institutions.id, name: institutions.name })
      .from(institutions)
      .where(eq(institutions.id, institutionId))
      .limit(1);

    if (!institution) {
      throw new Error(`Institution not found: ${institutionId}`);
    }

    const [existingUser] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new Error(`User already exists: ${email}`);
    }

    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash: hashPassword(password),
      })
      .returning({ id: users.id, email: users.email });

    if (!user) {
      throw new Error('User insert did not return a user.');
    }

    await tx.insert(userInstitutionRoles).values({
      userId: user.id,
      institutionId,
      role,
    });

    return { institution, user };
  });

  console.log('User created');
  console.log(`Email: ${result.user.email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${role}`);
  console.log(`Institution: ${result.institution.name} (${result.institution.id})`);
}

function parseArgs(argv: string[]) {
  const args: Args & { help?: boolean } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    index += 1;

    if (key === 'email') args.email = value;
    else if (key === 'host') args.host = value;
    else if (key === 'institution-id') args.institutionId = value;
    else if (key === 'password') args.password = value;
    else if (key === 'role') args.role = value;
    else throw new Error(`Unknown option: --${key}`);
  }

  return args;
}

function requireEmail(value: string | undefined) {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error('Provide a valid --email value.');
  }

  return value.trim().toLowerCase();
}

function requireRole(value: string | undefined): Role {
  if (!value || !ROLES.includes(value as Role)) {
    throw new Error(`Provide --role as one of: ${ROLES.join(', ')}.`);
  }

  return value as Role;
}

function resolveInstitutionId(args: Args) {
  if (args.institutionId) {
    if (!UUID_PATTERN.test(args.institutionId)) {
      throw new Error('Provide --institution-id as a UUID.');
    }

    return args.institutionId;
  }

  if (args.host) {
    const tenant = resolveTenantFromHost(args.host);

    if (!tenant) {
      throw new Error(`Could not resolve institution from host: ${args.host}`);
    }

    return tenant.institutionId;
  }

  throw new Error('Provide either --host or --institution-id.');
}

function generatePassword() {
  return `Edunic-${randomBytes(6).toString('base64url')}`;
}

function printHelp() {
  console.log(`Create an Edunic user.

Usage:
  npm run user:create -- --host central.localtest.me --role teacher --email teacher2@central.edu
  npm run user:create -- --institution-id 00000000-0000-0000-0000-000000000001 --role parent --email parent2@central.edu --password parent1234

Options:
  --email             User email address.
  --role              One of: admin, teacher, parent.
  --host              Institution domain or local test host.
  --institution-id    Institution UUID. Used when no host is provided.
  --password          Optional password. A temporary password is generated when omitted.
`);
}

main()
  .catch((error: unknown) => {
    console.error(getCliErrorMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

function getCliErrorMessage(error: unknown) {
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
