import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListGradesQuery } from '../schemas/grade.schemas.js';

type Database = FastifyInstance['db'];

type GradeSortColumn = ListGradesQuery['sortBy'];

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
};

export class GradesRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListGradesInput) {
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

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;

    const [items, totalRows] = await Promise.all([
      this.db.execute<GradeRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          enrollment_id as "enrollmentId",
          subject,
          score,
          created_at as "createdAt"
        from grades
        ${whereClause}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
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

  async findById(institutionId: string, gradeId: string) {
    const result = await this.db.execute<GradeRecord>(sql`
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

  async create(input: CreateGradeInput) {
    const result = await this.db.execute<{ id: string }>(sql`
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
