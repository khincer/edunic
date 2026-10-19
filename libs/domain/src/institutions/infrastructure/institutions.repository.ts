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
import type { ListInstitutionsQuery } from '../schemas/institution.schemas.js';

type InstitutionSortColumn = ListInstitutionsQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): name asc, id asc. The
// legacy default order is created_at desc, but created_at is a timestamp and
// the cursor only carries millisecond precision, so a timestamp order would
// skip rows that share a millisecond at a page boundary. Name is not unique,
// so the uuid `id` closes the order.
export const INSTITUTION_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['name', 'id'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const INSTITUTION_LIST_COLUMNS = {
  name: 'name',
  createdAt: 'created_at',
} as const;

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

export type ListInstitutionsInput = ListInstitutionsQuery & {
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListInstitutionsResult = {
  items: InstitutionRecord[];
  total?: number;
};

export class InstitutionsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListInstitutionsInput): Promise<ListInstitutionsResult> {
    const filters: SQL[] = [];

    if (input.search) {
      filters.push(sql`name ilike ${`%${input.search}%`}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], INSTITUTION_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, INSTITUTION_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause =
      filters.length > 0
        ? sql`where ${sql.join(filters, sql` and `)}`
        : sql``;
    const orderBy = plan.orderBy ?? this.legacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        id,
        name,
        sender_name as "senderName",
        reply_to_email as "replyToEmail",
        created_at as "createdAt"
      from institutions
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<InstitutionRecord>(itemsQuery);

      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<InstitutionRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from institutions
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

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

  async countDependencies(institutionId: string) {
    const [studentsResult, classroomsResult, enrollmentsResult] =
      await Promise.all([
        this.db.execute<CountRow>(sql`
          select count(*)::int as count
          from students
          where institution_id = ${institutionId}
        `),
        this.db.execute<CountRow>(sql`
          select count(*)::int as count
          from classrooms
          where institution_id = ${institutionId}
        `),
        this.db.execute<CountRow>(sql`
          select count(*)::int as count
          from enrollments
          where institution_id = ${institutionId}
        `),
      ]);

    return {
      students: this.toCount(studentsResult.rows[0]?.count),
      classrooms: this.toCount(classroomsResult.rows[0]?.count),
      enrollments: this.toCount(enrollmentsResult.rows[0]?.count),
    };
  }

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListInstitutionsInput): SQL {
    return (
      buildSortSql(input.sort ?? null, INSTITUTION_LIST_COLUMNS) ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}`
    );
  }

  private getSortColumn(sortBy: InstitutionSortColumn) {
    switch (sortBy) {
      case 'name':
        return sql.raw('name');
      default:
        return sql.raw('created_at');
    }
  }

  private getSortOrder(sortOrder: ListInstitutionsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
