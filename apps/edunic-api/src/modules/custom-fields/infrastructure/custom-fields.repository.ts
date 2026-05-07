import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  CustomFieldType,
  ListCustomFieldsQuery,
} from '../schemas/custom-field.schemas.js';

type Database = FastifyInstance['db'];

type CountRow = {
  count: string | number;
};

export type CustomFieldRecord = {
  id: string;
  institutionId: string;
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
  constructor(private readonly db: Database) {}

  async list(input: ListCustomFieldsQuery & { institutionId: string }) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.entity) {
      filters.push(sql`entity = ${input.entity}`);
    }

    const whereClause = sql.join(filters, sql` and `);

    const [items, totalRows] = await Promise.all([
      this.db.execute<CustomFieldRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          entity,
          name,
          type
        from custom_fields
        where ${whereClause}
        order by entity asc, name asc
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from custom_fields
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(institutionId: string, customFieldId: string) {
    const result = await this.db.execute<CustomFieldRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        entity,
        name,
        type
      from custom_fields
      where id = ${customFieldId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findManyByIds(institutionId: string, fieldIds: string[]) {
    if (fieldIds.length === 0) {
      return [];
    }

    const result = await this.db.execute<CustomFieldRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        entity,
        name,
        type
      from custom_fields
      where institution_id = ${institutionId}
        and id in ${sql`(${sql.join(fieldIds.map((id) => sql`${id}`), sql`, `)})`}
    `);

    return result.rows;
  }

  async create(input: {
    institutionId: string;
    entity: string;
    name: string;
    type: CustomFieldType;
  }) {
    const result = await this.db.execute<CustomFieldRecord>(sql`
      insert into custom_fields (
        institution_id,
        entity,
        name,
        type
      )
      values (
        ${input.institutionId},
        ${input.entity},
        ${input.name},
        ${input.type}
      )
      returning
        id,
        institution_id as "institutionId",
        entity,
        name,
        type
    `);

    return result.rows[0];
  }

  async update(input: {
    institutionId: string;
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
      return this.findById(input.institutionId, input.customFieldId);
    }

    const result = await this.db.execute<CustomFieldRecord>(sql`
      update custom_fields
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.customFieldId}
        and institution_id = ${input.institutionId}
      returning
        id,
        institution_id as "institutionId",
        entity,
        name,
        type
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, customFieldId: string) {
    const result = await this.db.execute<CustomFieldRecord>(sql`
      delete from custom_fields
      where id = ${customFieldId}
        and institution_id = ${institutionId}
      returning
        id,
        institution_id as "institutionId",
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
    institutionId: string;
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
      where custom_fields.institution_id = ${input.institutionId}
        and custom_fields.entity = ${input.entity}
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
