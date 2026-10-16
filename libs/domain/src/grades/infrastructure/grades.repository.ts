import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildSortSql,
  type DbExecutor,
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListGradesQuery } from '../schemas/grade.schemas.js';

type GradeSortColumn = ListGradesQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): created_at, id.
export const GRADE_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['created_at', 'id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const GRADE_LIST_COLUMNS = {
  subject: 'subject',
  score: 'score',
  enrollmentId: 'enrollment_id',
  createdAt: 'created_at',
} as const;

type CountRow = {
  count: string | number;
};

type ExistsRow = {
  id: string;
};

export type GradeRecord = {
  id: string;
  institutionId: string;
  enrollmentId: string;
  subject: string;
  score: number;
  createdAt: Date | null;
};

export type CreateGradeInput = {
  institutionId: string;
  enrollmentId: string;
  subject: string;
  score: number;
};

export type UpdateGradeInput = {
  institutionId: string;
  gradeId: string;
  subject?: string;
  score?: number;
};

export type ListGradesInput = ListGradesQuery & {
  institutionId: string;
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListGradesResult = {
  items: GradeRecord[];
  total?: number;
};

export class GradesRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // D2: services wrap the domain write, the outbox insert and the event
  // publish in one transaction so they commit or roll back together.
  async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async list(input: ListGradesInput): Promise<ListGradesResult> {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.search) {
      filters.push(sql`subject ilike ${`%${input.search}%`}`);
    }

    if (input.enrollmentId) {
      filters.push(sql`enrollment_id = ${input.enrollmentId}`);
    }

    if (input.subject) {
      filters.push(sql`subject ilike ${`%${input.subject}%`}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], GRADE_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, GRADE_CURSOR_ORDER);

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
        institution_id as "institutionId",
        enrollment_id as "enrollmentId",
        subject,
        score,
        created_at as "createdAt"
      from grades
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<GradeRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<GradeRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from grades
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(
    institutionId: string,
    gradeId: string,
    executor: DbExecutor = this.db
  ) {
    const result = await executor.execute<GradeRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        enrollment_id as "enrollmentId",
        subject,
        score,
        created_at as "createdAt"
      from grades
      where id = ${gradeId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateGradeInput, executor: DbExecutor = this.db) {
    const result = await executor.execute<{ id: string }>(sql`
      insert into grades (
        institution_id,
        enrollment_id,
        subject,
        score
      )
      values (
        ${input.institutionId},
        ${input.enrollmentId},
        ${input.subject},
        ${input.score}
      )
      returning id
    `);

    return result.rows[0];
  }

  async update(input: UpdateGradeInput) {
    const assignments: SQL[] = [];

    if (input.subject !== undefined) {
      assignments.push(sql`subject = ${input.subject}`);
    }

    if (input.score !== undefined) {
      assignments.push(sql`score = ${input.score}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.institutionId, input.gradeId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update grades
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.gradeId}
        and institution_id = ${input.institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, gradeId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from grades
      where id = ${gradeId}
        and institution_id = ${institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async findEnrollment(institutionId: string, enrollmentId: string) {
    const result = await this.db.execute<ExistsRow>(sql`
      select id
      from enrollments
      where id = ${enrollmentId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  private getSortColumn(sortBy: GradeSortColumn) {
    switch (sortBy) {
      case 'subject':
        return sql.raw('subject');
      case 'score':
        return sql.raw('score');
      default:
        return sql.raw('created_at');
    }
  }

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListGradesInput): SQL {
    const standardSort = buildSortSql(input.sort ?? null, GRADE_LIST_COLUMNS);

    return (
      standardSort ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}`
    );
  }

  private getSortOrder(sortOrder: ListGradesQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
