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

type CountRow = {
  count: string | number;
};

export type CreateInstitutionInput = {
  name: string;
};

export type UpdateInstitutionInput = {
  institutionId: string;
  name?: string;
  senderName?: string | null;
  replyToEmail?: string | null;
};

export class InstitutionsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findById(institutionId: string) {
    const result = await this.db.execute<InstitutionRecord>(sql`
      select
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
      from institutions
      where id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // The single school. The oldest row wins so the id stays stable for the
  // endpoints that still address a school by id.
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

  async create(input: CreateInstitutionInput) {
    const result = await this.db.execute<InstitutionRecord>(sql`
      insert into institutions (name)
      values (${input.name})
      returning
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
    `);

    return result.rows[0];
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
      return this.findById(input.institutionId);
    }

    const result = await this.db.execute<InstitutionRecord>(sql`
      update institutions
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.institutionId}
      returning
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string) {
    const result = await this.db.execute<InstitutionRecord>(sql`
      delete from institutions
      where id = ${institutionId}
      returning
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }


  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
