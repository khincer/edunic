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
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListStudentsQuery } from '../schemas/student.schemas.js';

type StudentSortColumn = ListStudentsQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): last_name, first_name, id.
export const STUDENT_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['last_name', 'first_name', 'id'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const STUDENT_LIST_COLUMNS = {
  firstName: 'first_name',
  lastName: 'last_name',
  dateOfBirth: 'date_of_birth',
  createdAt: 'created_at',
} as const;

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
  // Restricts the list to these students; undefined means unscoped.
  studentIds?: string[];
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListStudentsResult = {
  items: StudentRecord[];
  total?: number;
};

export class StudentsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListStudentsInput): Promise<ListStudentsResult> {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    const scope = buildStudentIdCondition('id', input.studentIds);

    if (scope) {
      filters.push(scope);
    }

    if (input.search) {
      filters.push(sql`(
        first_name ilike ${`%${input.search}%`}
        or last_name ilike ${`%${input.search}%`}
      )`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], STUDENT_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, STUDENT_CURSOR_ORDER);

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
        first_name as "firstName",
        last_name as "lastName",
        date_of_birth as "dateOfBirth",
        created_at as "createdAt"
      from students
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<StudentRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<StudentRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from students
        ${whereClause}
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

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListStudentsInput): SQL {
    const standardSort = buildSortSql(input.sort ?? null, STUDENT_LIST_COLUMNS);

    return (
      standardSort ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}`
    );
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
