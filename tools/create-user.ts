import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../libs/domain/src/auth/application/password.js';
import { db, pool } from '../libs/db/src/index.js';
import { userRoles, users } from '../libs/db/src/schema/index.js';
import { getCliErrorMessage, renderHelp } from './cli-utils.js';

const ROLES = [
  'director',
  'vice_director',
  'subdirector',
  'teacher',
  'parent',
] as const;

type Role = (typeof ROLES)[number];

type Args = {
  email?: string;
  password?: string;
  role?: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    renderHelp(
      'Create an Edunic user.',
      [
        'npm run user:create -- --role teacher --email teacher2@central.edu',
        'npm run user:create -- --role parent --email parent2@central.edu --password parent1234',
      ],
      [
        { name: 'email', description: 'User email address.' },
        { name: 'role', description: `One of: ${ROLES.join(', ')}.` },
        { name: 'password', description: 'Optional password. A temporary password is generated when omitted.' },
      ],
    );
    return;
  }

  const email = requireEmail(args.email);
  const role = requireRole(args.role);
  const password = args.password ?? generatePassword();

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const result = await db.transaction(async (tx) => {
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

    await tx.insert(userRoles).values({
      userId: user.id,
      role,
    });

    return { user };
  });

  console.log('User created');
  console.log(`Email: ${result.user.email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${role}`);
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

function generatePassword() {
  return `Edunic-${randomBytes(6).toString('base64url')}`;
}

main()
  .catch((error: unknown) => {
    console.error(getCliErrorMessage(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
