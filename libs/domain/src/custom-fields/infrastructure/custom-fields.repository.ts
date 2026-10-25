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
import type {
  CustomFieldType,
  ListCustomFieldsQuery,
} from '../schemas/custom-field.schemas.js';

// Stable keyset order for cursor pagination (P2-R4): entity asc, id asc.
export const CUSTOM_FIELD_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['entity', 'id'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const CUSTOM_FIELD_LIST_COLUMNS = {
  entity: 'entity',
  name: 'name',
  type: 'type',
} as const;

export type ListCustomFieldsInput = ListCustomFieldsQuery & {
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListCustomFieldsResult = {
  items: CustomFieldRecord[];
  total?: number;
};

type CountRow = {
  count: string | number;
};

export type CustomFieldRecord = {
  id: string;
  entity: string;
  name: string;
  type: CustomFieldType;
};

export type CustomFieldValueRecord = {
  id: string;
  fieldId: string;
  entityId: string;
  value: unknown;
  fieldEntity: string;
  fieldName: string;
  fieldType: CustomFieldType;
};

export class CustomFieldsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListCustomFieldsInput): Promise<ListCustomFieldsResult> {
    const filters: SQL[] = [sql`true`];

    if (input.entity) {
      filters.push(sql`entity = ${input.entity}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], CUSTOM_FIELD_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, CUSTOM_FIELD_CURSOR_ORDER);

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
        entity,
        name,
        type
      from custom_fields
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<CustomFieldRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<CustomFieldRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from custom_fields
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  // The standard `sort` param wins over the legacy entity/name order; cursor
  // mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListCustomFieldsInput): SQL {
    const standardSort = buildSortSql(
      input.sort ?? null,
      CUSTOM_FIELD_LIST_COLUMNS
    );

    return standardSort ?? sql`entity asc, name asc`;
  }

  async findById(customFieldId: string) {
    const result = await this.db.execute<CustomFieldRecord>(sql`
      select
        id,
        entity,
        name,
        type
      from custom_fields
      where id = ${customFieldId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findManyByIds(fieldIds: string[]) {
    if (fieldIds.length === 0) {
      return [];
    }

    const result = await this.db.execute<CustomFieldRecord>(sql`
      select
        id,
        entity,
        name,
        type
      from custom_fields
      where id in ${sql`(${sql.join(fieldIds.map((id) => sql`${id}`), sql`, `)})`}
    `);

    return result.rows;
  }

  async create(input: {
    entity: string;
    name: string;
    type: CustomFieldType;
  }) {
    const result = await this.db.execute<CustomFieldRecord>(sql`
      insert into custom_fields (
        entity,
        name,
        type
      )
      values (
        ${input.entity},
        ${input.name},
        ${input.type}
      )
      returning
        id,
        entity,
        name,
        type
    `);

    return result.rows[0];
  }

  async update(input: {
    customFieldId: string;
    name?: string;
    type?: CustomFieldType;
  }) {
    const assignments: SQL[] = [];

    if (input.name !== undefined) {
      assignments.push(sql`name = ${input.name}`);
    }

    if (input.type !== undefined) {
      assignments.push(sql`type = ${input.type}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.customFieldId);
    }

    const result = await this.db.execute<CustomFieldRecord>(sql`
      update custom_fields
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.customFieldId}
      returning
        id,
        entity,
        name,
        type
    `);

    return result.rows[0] ?? null;
  }

  async delete(customFieldId: string) {
    const result = await this.db.execute<CustomFieldRecord>(sql`
      delete from custom_fields
      where id = ${customFieldId}
      returning
        id,
        entity,
        name,
        type
    `);

    return result.rows[0] ?? null;
  }

  async countValues(customFieldId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from custom_field_values
      where field_id = ${customFieldId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  async listValues(input: {
    entity: string;
    entityId: string;
  }) {
    const result = await this.db.execute<CustomFieldValueRecord>(sql`
      select
        custom_field_values.id,
        custom_field_values.field_id as "fieldId",
        custom_field_values.entity_id as "entityId",
        custom_field_values.value,
        custom_fields.entity as "fieldEntity",
        custom_fields.name as "fieldName",
        custom_fields.type as "fieldType"
      from custom_fields
      left join custom_field_values
        on custom_field_values.field_id = custom_fields.id
        and custom_field_values.entity_id = ${input.entityId}
      where custom_fields.entity = ${input.entity}
      order by custom_fields.name asc
    `);

    return result.rows;
  }

  async upsertValue(input: {
    fieldId: string;
    entityId: string;
    value: unknown;
  }) {
    await this.db.execute(sql`
      insert into custom_field_values (
        field_id,
        entity_id,
        value
      )
      values (
        ${input.fieldId},
        ${input.entityId},
        ${JSON.stringify(input.value)}::jsonb
      )
      on conflict (field_id, entity_id)
      do update set value = excluded.value
    `);
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
