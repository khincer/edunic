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
import type { ListAcademicPeriodsQuery } from '../schemas/academic-period.schemas.js';

type AcademicPeriodSortColumn = ListAcademicPeriodsQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): year desc, id desc —
// year leads, the unique id makes the order total.
export const ACADEMIC_PERIOD_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['year', 'id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const ACADEMIC_PERIOD_LIST_COLUMNS = {
  year: 'year',
  term: 'term',
  startDate: 'start_date',
  endDate: 'end_date',
  createdAt: 'created_at',
} as const;

type CountRow = {
  count: string | number;
};

export type AcademicPeriodRecord = {
  id: string;
  year: number;
  term: number;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date | null;
};

export type CreateAcademicPeriodInput = {
  year: number;
  term: number;
  startDate?: string;
  endDate?: string;
};

export type UpdateAcademicPeriodInput = {
  academicPeriodId: string;
  year?: number;
  term?: number;
  startDate?: string | null;
  endDate?: string | null;
};

export type ListAcademicPeriodsInput = ListAcademicPeriodsQuery & {
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListAcademicPeriodsResult = {
  items: AcademicPeriodRecord[];
  total?: number;
};

export class AcademicPeriodsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListAcademicPeriodsInput): Promise<ListAcademicPeriodsResult> {
    const filters: SQL[] = [sql`true`];

    if (input.year !== undefined) {
      filters.push(sql`year = ${input.year}`);
    }

    if (input.term !== undefined) {
      filters.push(sql`term = ${input.term}`);
    }

    filters.push(
      ...buildFilterConditions(
        input.filters ?? [],
        ACADEMIC_PERIOD_LIST_COLUMNS
      )
    );

    const plan = applyCursorPagination(input, ACADEMIC_PERIOD_CURSOR_ORDER);

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
        year,
        term,
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt"
      from academic_periods
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<AcademicPeriodRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<AcademicPeriodRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from academic_periods
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(academicPeriodId: string) {
    const result = await this.db.execute<AcademicPeriodRecord>(sql`
      select
        id,
        year,
        term,
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt"
      from academic_periods
      where id = ${academicPeriodId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findByYearAndTerm(
    year: number,
    term: number,
    excludeAcademicPeriodId?: string
  ) {
    const excludeClause = excludeAcademicPeriodId
      ? sql`and id <> ${excludeAcademicPeriodId}`
      : sql``;

    const result = await this.db.execute<{ id: string }>(sql`
      select id
      from academic_periods
      where year = ${year}
        and term = ${term}
        ${excludeClause}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateAcademicPeriodInput) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into academic_periods (
        year,
        term,
        start_date,
        end_date
      )
      values (
        ${input.year},
        ${input.term},
        ${input.startDate ?? null},
        ${input.endDate ?? null}
      )
      returning id
    `);

    return result.rows[0];
  }

  async update(input: UpdateAcademicPeriodInput) {
    const assignments: SQL[] = [];

    if (input.year !== undefined) {
      assignments.push(sql`year = ${input.year}`);
    }

    if (input.term !== undefined) {
      assignments.push(sql`term = ${input.term}`);
    }

    if (input.startDate !== undefined) {
      assignments.push(sql`start_date = ${input.startDate}`);
    }

    if (input.endDate !== undefined) {
      assignments.push(sql`end_date = ${input.endDate}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.academicPeriodId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update academic_periods
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.academicPeriodId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(academicPeriodId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from academic_periods
      where id = ${academicPeriodId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async countEnrollments(academicPeriodId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from enrollments
      where academic_period_id = ${academicPeriodId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  private getSortColumn(sortBy: AcademicPeriodSortColumn) {
    switch (sortBy) {
      case 'createdAt':
        return sql.raw('created_at');
      case 'term':
        return sql.raw('term');
      case 'startDate':
        return sql.raw('start_date');
      default:
        return sql.raw('year');
    }
  }

  private getSortOrder(sortOrder: ListAcademicPeriodsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListAcademicPeriodsInput): SQL {
    const standardSort = buildSortSql(
      input.sort ?? null,
      ACADEMIC_PERIOD_LIST_COLUMNS
    );

    return (
      standardSort ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}`
    );
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
