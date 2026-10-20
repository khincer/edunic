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
  institutionId: string;
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
  // model). The institution is still read from `user_institution_roles`
  // because the tenant columns survive until the contract migration; the
  // join is what keeps every domain query tenant-scoped in the meantime.
  // shortcut: the institution is resolved per user here; drop this join when
  // the domain no longer filters by institution.
  async findAuthContext(userId: string) {
    const result = await this.db.execute<UserRoleRecord>(sql`
      select
        r.role as "role",
        uir.institution_id as "institutionId"
      from user_roles r
      join user_institution_roles uir on uir.user_id = r.user_id
      where r.user_id = ${userId}
      order by uir.id asc
      limit 1
    `);

    return result.rows[0] ?? null;
  }
}
