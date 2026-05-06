import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListAuditLogsQuery } from '../schemas/audit-log.schemas.js';

type Database = FastifyInstance['db'];

type CountRow = {
  count: string | number;
};

export type AuditLogRecord = {
  id: string;
  institutionId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date | null;
};

export type CreateAuditLogInput = {
  institutionId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export type ListAuditLogsInput = ListAuditLogsQuery & {
  institutionId: string;
};

export class AuditLogsRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateAuditLogInput) {
    const result = await this.db.execute<AuditLogRecord>(sql`
      insert into audit_logs (
        institution_id,
        user_id,
        action,
        entity,
        entity_id,
        before,
        after
      )
      values (
        ${input.institutionId},
        ${input.userId ?? null},
        ${input.action},
        ${input.entity},
        ${input.entityId ?? null},
        ${JSON.stringify(input.before ?? null)}::jsonb,
        ${JSON.stringify(input.after ?? null)}::jsonb
      )
      returning
        id,
        institution_id as "institutionId",
        user_id as "userId",
        action,
        entity,
        entity_id as "entityId",
        before,
        after,
        created_at as "createdAt"
    `);

    return result.rows[0];
  }

  async list(input: ListAuditLogsInput) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.entity) {
      filters.push(sql`entity = ${input.entity}`);
    }

    if (input.action) {
      filters.push(sql`action = ${input.action}`);
    }

    if (input.userId) {
      filters.push(sql`user_id = ${input.userId}`);
    }

    const whereClause = sql.join(filters, sql` and `);

    const [items, totalRows] = await Promise.all([
      this.db.execute<AuditLogRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          user_id as "userId",
          action,
          entity,
          entity_id as "entityId",
          before,
          after,
          created_at as "createdAt"
        from audit_logs
        where ${whereClause}
        order by created_at ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from audit_logs
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  private getSortOrder(sortOrder: ListAuditLogsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
