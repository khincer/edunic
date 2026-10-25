import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildStudentIdCondition,
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
  columns: ['g.created_at', 'g.id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const GRADE_LIST_COLUMNS = {
  subject: 's.name',
  score: 'g.score',
  enrollmentId: 'g.enrollment_id',
  createdAt: 'g.created_at',
} as const;

// The student a grade belongs to, through its enrollment. Constant literal.
const GRADE_STUDENT_ID =
  '(select e.student_id from enrollments e where e.id = g.enrollment_id)';

type CountRow = {
  count: string | number;
};

type ExistsRow = {
  id: string;
};

export type GradeRecord = {
  id: string;
  enrollmentId: string;
  subjectId: string;
  topicId: string | null;
  // The name of the materia, so the response still reads like a grade.
  subject: string;
  score: number;
  createdAt: Date | null;
};

export type CreateGradeInput = {
  enrollmentId: string;
  subjectId: string;
  topicId?: string | null;
  score: number;
};

export type UpdateGradeInput = {
  gradeId: string;
  subjectId?: string;
  topicId?: string | null;
  score?: number;
};

export type ListGradesInput = ListGradesQuery & {
  // Restricts the list to these students; undefined means unscoped.
  studentIds?: string[];
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
    const filters: SQL[] = [];
    const scope = buildStudentIdCondition(GRADE_STUDENT_ID, input.studentIds);

    if (scope) {
      filters.push(scope);
    }

    if (input.search) {
      filters.push(sql`s.name ilike ${`%${input.search}%`}`);
    }

    if (input.enrollmentId) {
      filters.push(sql`g.enrollment_id = ${input.enrollmentId}`);
    }

    if (input.subjectId) {
      filters.push(sql`g.subject_id = ${input.subjectId}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], GRADE_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, GRADE_CURSOR_ORDER);

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
        g.id,
        g.enrollment_id as "enrollmentId",
        g.subject_id as "subjectId",
        g.topic_id as "topicId",
        s.name as subject,
        g.score,
        g.created_at as "createdAt"
      from grades g
      join subjects s on s.id = g.subject_id
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
        from grades g
        join subjects s on s.id = g.subject_id
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  // The materia a tema belongs to: a grade that names a topic without its
  // materia would point at two different subjects.
  async findTopicSubjectId(topicId: string) {
    const result = await this.db.execute<{ subjectId: string }>(sql`
      select subject_id as "subjectId"
      from topics
      where id = ${topicId}
      limit 1
    `);

    return result.rows[0]?.subjectId ?? null;
  }

  async findById(gradeId: string, executor: DbExecutor = this.db) {
    const result = await executor.execute<GradeRecord>(sql`
      select
        g.id,
        g.enrollment_id as "enrollmentId",
        g.subject_id as "subjectId",
        g.topic_id as "topicId",
        s.name as subject,
        g.score,
        g.created_at as "createdAt"
      from grades g
      join subjects s on s.id = g.subject_id
      where g.id = ${gradeId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateGradeInput, executor: DbExecutor = this.db) {
    const result = await executor.execute<{ id: string }>(sql`
      insert into grades (
        enrollment_id,
        subject_id,
        topic_id,
        score
      )
      values (
        ${input.enrollmentId},
        ${input.subjectId},
        ${input.topicId ?? null},
        ${input.score}
      )
      returning id
    `);

    return result.rows[0];
  }

  async update(input: UpdateGradeInput) {
    const assignments: SQL[] = [];

    if (input.subjectId !== undefined) {
      assignments.push(sql`subject_id = ${input.subjectId}`);
    }

    if (input.topicId !== undefined) {
      assignments.push(sql`topic_id = ${input.topicId}`);
    }

    if (input.score !== undefined) {
      assignments.push(sql`score = ${input.score}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.gradeId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update grades
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.gradeId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(gradeId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from grades
      where id = ${gradeId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async findEnrollment(enrollmentId: string) {
    const result = await this.db.execute<ExistsRow>(sql`
      select id
      from enrollments
      where id = ${enrollmentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  private getSortColumn(sortBy: GradeSortColumn) {
    switch (sortBy) {
      case 'subject':
        return sql.raw('s.name');
      case 'score':
        return sql.raw('g.score');
      default:
        return sql.raw('g.created_at');
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
