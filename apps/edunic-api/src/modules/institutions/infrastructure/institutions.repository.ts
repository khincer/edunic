import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListInstitutionsQuery } from '../schemas/institution.schemas.js';

type Database = FastifyInstance['db'];

type InstitutionSortColumn = ListInstitutionsQuery['sortBy'];

export type InstitutionRecord = {
  id: string;
  name: string;
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
};

export type ListInstitutionsInput = ListInstitutionsQuery;

export class InstitutionsRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListInstitutionsInput) {
    const searchFilter = input.search
      ? sql`where name ilike ${`%${input.search}%`}`
      : sql``;

    const [items, totalRows] = await Promise.all([
      this.db.execute<InstitutionRecord>(sql`
        select
          id,
          name,
          created_at as "createdAt"
        from institutions
        ${searchFilter}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from institutions
        ${searchFilter}
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
        created_at as "createdAt"
    `);

    return result.rows[0];
  }

  async update(input: UpdateInstitutionInput) {
    const assignments: SQL[] = [];

    if (input.name !== undefined) {
      assignments.push(sql`name = ${input.name}`);
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
