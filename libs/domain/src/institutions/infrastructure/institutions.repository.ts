import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type InstitutionRecord = {
  id: string;
  name: string;
  senderName: string | null;
  replyToEmail: string | null;
  createdAt: Date | null;
};

export type UpdateInstitutionInput = {
  id: string;
  name?: string;
  senderName?: string | null;
  replyToEmail?: string | null;
};

export class InstitutionsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findById(id: string) {
    const result = await this.db.execute<InstitutionRecord>(sql`
      select
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
      from institutions
      where id = ${id}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // The single school. The oldest row wins so the id stays stable.
  async findSingle() {
    const result = await this.db.execute<InstitutionRecord>(sql`
      select
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
      from institutions
      order by created_at asc, id asc
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async update(input: UpdateInstitutionInput) {
    const assignments: SQL[] = [];

    if (input.name !== undefined) {
      assignments.push(sql`name = ${input.name}`);
    }

    if (input.senderName !== undefined) {
      assignments.push(sql`sender_name = ${input.senderName}`);
    }

    if (input.replyToEmail !== undefined) {
      assignments.push(sql`reply_to_email = ${input.replyToEmail}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.id);
    }

    const result = await this.db.execute<InstitutionRecord>(sql`
      update institutions
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.id}
      returning
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }
}
