import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildSortSql,
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListAuditLogsQuery } from '../schemas/audit-log.schemas.js';

type CountRow = {
  count: string | number;
};

// Stable keyset order for cursor pagination (P2-R4): created_at desc, id desc.
export const AUDIT_LOG_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['created_at', 'id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const AUDIT_LOG_LIST_COLUMNS = {
  entity: 'entity',
  action: 'action',
  userId: 'user_id',
  entityId: 'entity_id',
  createdAt: 'created_at',
} as const;

export type AuditLogRecord = {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date | null;
};

export type CreateAuditLogInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export type ListAuditLogsInput = ListAuditLogsQuery & {
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListAuditLogsResult = {
  items: AuditLogRecord[];
  total?: number;
};

export class AuditLogsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async create(input: CreateAuditLogInput) {
    const result = await this.db.execute<AuditLogRecord>(sql`
      insert into audit_logs (
        user_id,
        action,
        entity,
        entity_id,
        before,
        after
      )
      values (
        ${input.userId ?? null},
        ${input.action},
        ${input.entity},
        ${input.entityId ?? null},
        ${JSON.stringify(input.before ?? null)}::jsonb,
        ${JSON.stringify(input.after ?? null)}::jsonb
      )
      returning
        id,
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

  async list(input: ListAuditLogsInput): Promise<ListAuditLogsResult> {
    const filters: SQL[] = [sql`true`];

    if (input.entity) {
      filters.push(sql`entity = ${input.entity}`);
    }

    if (input.action) {
      filters.push(sql`action = ${input.action}`);
    }

    if (input.userId) {
      filters.push(sql`user_id = ${input.userId}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], AUDIT_LOG_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, AUDIT_LOG_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;
    const orderBy = plan.orderBy ?? this.legacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        id,
        user_id as "userId",
        action,
        entity,
        entity_id as "entityId",
        before,
        after,
        created_at as "createdAt"
      from audit_logs
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<AuditLogRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<AuditLogRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from audit_logs
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  // The standard `sort` param wins over the legacy sortOrder; cursor mode never
  // reaches here (stable order wins).
  private legacyOrderBy(input: ListAuditLogsInput): SQL {
    const standardSort = buildSortSql(
      input.sort ?? null,
      AUDIT_LOG_LIST_COLUMNS
    );

    return (
      standardSort ??
      sql`created_at ${this.getSortOrder(input.sortOrder)}`
    );
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
