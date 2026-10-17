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
import type { ListExtensionsQuery } from '../schemas/extension.schemas.js';

// Stable keyset order for cursor pagination (P2-R4): key asc. `key` is the
// table's text primary key, so it is both the sort column and the tiebreaker —
// there is no second column to append.
export const EXTENSION_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['key'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const EXTENSION_LIST_COLUMNS = {
  key: 'key',
  name: 'name',
} as const;

type CountRow = {
  count: string | number;
};

export type ExtensionRecord = {
  key: string;
  name: string | null;
  enabled: boolean | null;
};

export type InstitutionExtensionRecord = {
  institutionId: string;
  extensionKey: string;
  config: Record<string, unknown> | null;
  extensionName: string | null;
  extensionEnabled: boolean | null;
};

export type CreateExtensionInput = {
  key: string;
  name: string;
  enabled: boolean;
};

export type UpdateExtensionInput = {
  key: string;
  name?: string | null;
  enabled?: boolean;
};

export type ListExtensionsInput = ListExtensionsQuery & {
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListExtensionsResult = {
  items: ExtensionRecord[];
  total?: number;
};

export class ExtensionsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListExtensionsInput): Promise<ListExtensionsResult> {
    const filters: SQL[] = [];

    if (input.search) {
      filters.push(sql`(key ilike ${`%${input.search}%`} or coalesce(name, '') ilike ${`%${input.search}%`})`);
    }

    if (input.enabled !== undefined) {
      filters.push(sql`enabled = ${input.enabled}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], EXTENSION_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, EXTENSION_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause =
      filters.length > 0 ? sql`where ${sql.join(filters, sql` and `)}` : sql``;
    const orderBy = plan.orderBy ?? this.legacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        key,
        name,
        enabled
      from extensions
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<ExtensionRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<ExtensionRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from extensions
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findByKey(key: string) {
    const result = await this.db.execute<ExtensionRecord>(sql`
      select
        key,
        name,
        enabled
      from extensions
      where key = ${key}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateExtensionInput) {
    const result = await this.db.execute<ExtensionRecord>(sql`
      insert into extensions (
        key,
        name,
        enabled
      )
      values (
        ${input.key},
        ${input.name},
        ${input.enabled}
      )
      returning
        key,
        name,
        enabled
    `);

    return result.rows[0];
  }

  async update(input: UpdateExtensionInput) {
    const assignments: SQL[] = [];

    if (input.name !== undefined) {
      assignments.push(sql`name = ${input.name}`);
    }

    if (input.enabled !== undefined) {
      assignments.push(sql`enabled = ${input.enabled}`);
    }

    if (assignments.length === 0) {
      return this.findByKey(input.key);
    }

    const result = await this.db.execute<ExtensionRecord>(sql`
      update extensions
      set ${sql.join(assignments, sql`, `)}
      where key = ${input.key}
      returning
        key,
        name,
        enabled
    `);

    return result.rows[0] ?? null;
  }

  async listInstitutionExtensions(institutionId: string) {
    const result = await this.db.execute<InstitutionExtensionRecord>(sql`
      select
        institution_extensions.institution_id as "institutionId",
        institution_extensions.extension_key as "extensionKey",
        institution_extensions.config,
        extensions.name as "extensionName",
        extensions.enabled as "extensionEnabled"
      from institution_extensions
      inner join extensions
        on extensions.key = institution_extensions.extension_key
      where institution_extensions.institution_id = ${institutionId}
      order by institution_extensions.extension_key asc
    `);

    return result.rows;
  }

  async findInstitutionExtension(institutionId: string, extensionKey: string) {
    const result = await this.db.execute<InstitutionExtensionRecord>(sql`
      select
        institution_extensions.institution_id as "institutionId",
        institution_extensions.extension_key as "extensionKey",
        institution_extensions.config,
        extensions.name as "extensionName",
        extensions.enabled as "extensionEnabled"
      from institution_extensions
      inner join extensions
        on extensions.key = institution_extensions.extension_key
      where institution_extensions.institution_id = ${institutionId}
        and institution_extensions.extension_key = ${extensionKey}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async upsertInstitutionExtension(input: {
    institutionId: string;
    extensionKey: string;
    config: Record<string, unknown>;
  }) {
    await this.db.execute(sql`
      insert into institution_extensions (
        institution_id,
        extension_key,
        config
      )
      values (
        ${input.institutionId},
        ${input.extensionKey},
        ${JSON.stringify(input.config)}::jsonb
      )
      on conflict (institution_id, extension_key)
      do update set config = excluded.config
    `);

    return this.findInstitutionExtension(input.institutionId, input.extensionKey);
  }

  async deleteInstitutionExtension(institutionId: string, extensionKey: string) {
    const result = await this.db.execute<InstitutionExtensionRecord>(sql`
      delete from institution_extensions
      where institution_id = ${institutionId}
        and extension_key = ${extensionKey}
      returning
        institution_id as "institutionId",
        extension_key as "extensionKey",
        config,
        null as "extensionName",
        null as "extensionEnabled"
    `);

    return result.rows[0] ?? null;
  }

  // The standard `sort` param wins over the legacy sortOrder; cursor mode
  // never reaches here (stable order wins).
  private legacyOrderBy(input: ListExtensionsInput): SQL {
    return (
      buildSortSql(input.sort ?? null, EXTENSION_LIST_COLUMNS) ??
      sql`key ${this.getSortOrder(input.sortOrder)}`
    );
  }

  private getSortOrder(sortOrder: ListExtensionsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'desc' ? 'desc' : 'asc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
