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
  // model). No institution dimension.
  async findAuthContext(userId: string) {
    const result = await this.db.execute<UserRoleRecord>(sql`
      select
        role as "role"
      from user_roles
      where user_id = ${userId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }
}
