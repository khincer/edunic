import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

type Database = FastifyInstance['db'];

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date | null;
};

export type UserRoleRecord = {
  userId: string;
  institutionId: string;
  role: string;
};

export class AuthRepository {
  constructor(private readonly db: Database) {}

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

  async findUserRole(userId: string, institutionId: string) {
    const result = await this.db.execute<UserRoleRecord>(sql`
      select
        user_id as "userId",
        institution_id as "institutionId",
        role
      from user_institution_roles
      where user_id = ${userId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }
}
