import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListStudentsQuery } from '../schemas/student.schemas.js';

type Database = FastifyInstance['db'];

type StudentSortColumn = ListStudentsQuery['sortBy'];

export type StudentRecord = {
  id: string;
  institutionId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  createdAt: Date | null;
};

type CountRow = {
  count: string | number;
};

export type CreateStudentInput = {
  institutionId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
};

export type UpdateStudentInput = {
  institutionId: string;
  studentId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
};

export type ListStudentsInput = ListStudentsQuery & {
  institutionId: string;
};

export class StudentsRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListStudentsInput) {
    const searchFilter = input.search
      ? sql`and (
          first_name ilike ${`%${input.search}%`}
          or last_name ilike ${`%${input.search}%`}
        )`
      : sql``;

    const [items, totalRows] = await Promise.all([
      this.db.execute<StudentRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          first_name as "firstName",
          last_name as "lastName",
          date_of_birth as "dateOfBirth",
          created_at as "createdAt"
        from students
        where institution_id = ${input.institutionId}
        ${searchFilter}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from students
        where institution_id = ${input.institutionId}
        ${searchFilter}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(institutionId: string, studentId: string) {
    const result = await this.db.execute<StudentRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        first_name as "firstName",
        last_name as "lastName",
        date_of_birth as "dateOfBirth",
        created_at as "createdAt"
      from students
      where id = ${studentId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateStudentInput) {
    const result = await this.db.execute<StudentRecord>(sql`
      insert into students (
        institution_id,
        first_name,
        last_name,
        date_of_birth
      )
      values (
        ${input.institutionId},
        ${input.firstName},
        ${input.lastName},
        ${input.dateOfBirth ?? null}
      )
      returning
        id,
        institution_id as "institutionId",
        first_name as "firstName",
        last_name as "lastName",
        date_of_birth as "dateOfBirth",
        created_at as "createdAt"
    `);

    return result.rows[0];
  }

  async update(input: UpdateStudentInput) {
    const assignments: SQL[] = [];

    if (input.firstName !== undefined) {
      assignments.push(sql`first_name = ${input.firstName}`);
    }

    if (input.lastName !== undefined) {
      assignments.push(sql`last_name = ${input.lastName}`);
    }

    if (input.dateOfBirth !== undefined) {
      assignments.push(sql`date_of_birth = ${input.dateOfBirth ?? null}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.institutionId, input.studentId);
    }

    const result = await this.db.execute<StudentRecord>(sql`
      update students
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.studentId}
        and institution_id = ${input.institutionId}
      returning
        id,
        institution_id as "institutionId",
        first_name as "firstName",
        last_name as "lastName",
        date_of_birth as "dateOfBirth",
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, studentId: string) {
    const result = await this.db.execute<StudentRecord>(sql`
      delete from students
      where id = ${studentId}
        and institution_id = ${institutionId}
      returning
        id,
        institution_id as "institutionId",
        first_name as "firstName",
        last_name as "lastName",
        date_of_birth as "dateOfBirth",
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async countEnrollments(institutionId: string, studentId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from enrollments
      where institution_id = ${institutionId}
        and student_id = ${studentId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  private getSortColumn(sortBy: StudentSortColumn) {
    switch (sortBy) {
      case 'firstName':
        return sql.raw('first_name');
      case 'lastName':
        return sql.raw('last_name');
      default:
        return sql.raw('created_at');
    }
  }

  private getSortOrder(sortOrder: ListStudentsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
