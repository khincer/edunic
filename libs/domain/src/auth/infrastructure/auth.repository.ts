import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date | null;
};

export type UserRoleRecord = {
  role: string;
  institutionId: string | null;
};

export class AuthRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findUserByEmail(email: string) {
    const result = await this.db.execute<UserRecord>(sql`
      select
        id,
        email,
        password_hash as "passwordHash",
        created_at as "createdAt"
      from users
      where lower(email) = lower(${email})
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // The role comes from `user_roles` (one role per user, the single-school
  // model). The school is the single `institutions` row, resolved on the
  // server -- never from the client. The tenant columns survive until the
  // contract migration, so `institutionId` stays on the request user for the
  // domain code that still filters by it.
  // shortcut: drop `institutionId` when the domain stops filtering by it.
  async findAuthContext(userId: string) {
    const result = await this.db.execute<UserRoleRecord>(sql`
      select
        role as "role",
        (
          select id from institutions
          order by created_at asc nulls last, id asc
          limit 1
        ) as "institutionId"
      from user_roles
      where user_id = ${userId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }
}
