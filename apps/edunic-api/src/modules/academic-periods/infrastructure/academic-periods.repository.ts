import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListAcademicPeriodsQuery } from '../schemas/academic-period.schemas.js';

type Database = FastifyInstance['db'];

type AcademicPeriodSortColumn = ListAcademicPeriodsQuery['sortBy'];

type CountRow = {
  count: string | number;
};

export type AcademicPeriodRecord = {
  id: string;
  institutionId: string;
  year: number;
  term: number;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date | null;
};

export type CreateAcademicPeriodInput = {
  institutionId: string;
  year: number;
  term: number;
  startDate?: string;
  endDate?: string;
};

export type UpdateAcademicPeriodInput = {
  institutionId: string;
  academicPeriodId: string;
  year?: number;
  term?: number;
  startDate?: string | null;
  endDate?: string | null;
};

export type ListAcademicPeriodsInput = ListAcademicPeriodsQuery & {
  institutionId: string;
};

export class AcademicPeriodsRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListAcademicPeriodsInput) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.year !== undefined) {
      filters.push(sql`year = ${input.year}`);
    }

    if (input.term !== undefined) {
      filters.push(sql`term = ${input.term}`);
    }

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;

    const [items, totalRows] = await Promise.all([
      this.db.execute<AcademicPeriodRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          year,
          term,
          start_date as "startDate",
          end_date as "endDate",
          created_at as "createdAt"
        from academic_periods
        ${whereClause}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
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

  async findById(institutionId: string, academicPeriodId: string) {
    const result = await this.db.execute<AcademicPeriodRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        year,
        term,
        start_date as "startDate",
        end_date as "endDate",
        created_at as "createdAt"
      from academic_periods
      where id = ${academicPeriodId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findByYearAndTerm(
    institutionId: string,
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
      where institution_id = ${institutionId}
        and year = ${year}
        and term = ${term}
        ${excludeClause}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateAcademicPeriodInput) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into academic_periods (
        institution_id,
        year,
        term,
        start_date,
        end_date
      )
      values (
        ${input.institutionId},
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
      return this.findById(input.institutionId, input.academicPeriodId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update academic_periods
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.academicPeriodId}
        and institution_id = ${input.institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, academicPeriodId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from academic_periods
      where id = ${academicPeriodId}
        and institution_id = ${institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async countEnrollments(institutionId: string, academicPeriodId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from enrollments
      where institution_id = ${institutionId}
        and academic_period_id = ${academicPeriodId}
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

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
