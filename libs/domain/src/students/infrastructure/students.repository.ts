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
  type DbExecutor,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListStudentsQuery } from '../schemas/student.schemas.js';

type StudentSortColumn = ListStudentsQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): first_last_name,
// first_name, id.
export const STUDENT_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['first_last_name', 'first_name', 'id'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const STUDENT_LIST_COLUMNS = {
  firstName: 'first_name',
  secondName: 'second_name',
  firstLastName: 'first_last_name',
  secondLastName: 'second_last_name',
  dateOfBirth: 'date_of_birth',
  createdAt: 'created_at',
} as const;

const STUDENT_COLUMNS = sql.raw(`
  id,
  first_name as "firstName",
  second_name as "secondName",
  first_last_name as "firstLastName",
  second_last_name as "secondLastName",
  date_of_birth as "dateOfBirth",
  created_at as "createdAt"
`);

// The active period: the one covering today, else the latest by year and
// term (the same rule the dashboards use).
const ACTIVE_PERIOD_QUERY = sql.raw(`
  select id, year, term
  from academic_periods
  order by
    case
      when coalesce(start_date::date, current_date) <= current_date
       and coalesce(end_date::date, current_date) >= current_date
      then 0
      else 1
    end,
    year desc,
    term desc
  limit 1
`);

export type StudentRecord = {
  id: string;
  firstName: string;
  secondName: string | null;
  firstLastName: string;
  secondLastName: string | null;
  dateOfBirth: string | null;
  createdAt: Date | null;
};

// Where a student sits in the active period, plus their guardians.
export type StudentContextRecord = {
  studentId: string;
  academicPeriodId: string | null;
  classroomId: string | null;
  gradeLevel: number | null;
  section: string | null;
  guardians: { id: string; name: string }[];
};

export type AcademicPeriodRecord = {
  id: string;
  year: number;
  term: number;
};

export type ClassroomRecord = {
  id: string;
  gradeLevel: number;
  section: string | null;
};

export type GuardianRecord = {
  id: string;
  name: string;
  email: string | null;
};

export type UserAccountRecord = {
  id: string;
  role: string | null;
};

type CountRow = {
  count: string | number;
};

export type CreateStudentInput = {
  firstName: string;
  secondName?: string | null;
  firstLastName: string;
  secondLastName: string;
  dateOfBirth?: string | null;
};

export type UpdateStudentInput = {
  studentId: string;
  firstName?: string;
  secondName?: string | null;
  firstLastName?: string;
  secondLastName?: string;
  dateOfBirth?: string | null;
};

export type ListStudentsInput = ListStudentsQuery & {
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

  async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async list(input: ListStudentsInput): Promise<ListStudentsResult> {
    const filters: SQL[] = [];

    const scope = buildStudentIdCondition('id', input.studentIds);

    if (scope) {
      filters.push(scope);
    }

    if (input.search) {
      const pattern = `%${input.search}%`;

      filters.push(sql`(
        first_name ilike ${pattern}
        or coalesce(second_name, '') ilike ${pattern}
        or first_last_name ilike ${pattern}
        or coalesce(second_last_name, '') ilike ${pattern}
      )`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], STUDENT_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, STUDENT_CURSOR_ORDER);

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
      select ${STUDENT_COLUMNS}
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

  async findById(studentId: string) {
    const result = await this.db.execute<StudentRecord>(sql`
      select ${STUDENT_COLUMNS}
      from students
      where id = ${studentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // Grade, section and guardians of each student in the active period. Kept
  // apart from `list` so the page query and its cursor order stay untouched.
  async listContexts(studentIds: string[]) {
    const scope = buildStudentIdCondition('s.id', studentIds);

    if (!scope || studentIds.length === 0) {
      return [];
    }

    const result = await this.db.execute<StudentContextRecord>(sql`
      with active_period as (${ACTIVE_PERIOD_QUERY})
      select
        s.id as "studentId",
        e.academic_period_id as "academicPeriodId",
        e.classroom_id as "classroomId",
        c.grade_level as "gradeLevel",
        c.section,
        coalesce(
          (
            select json_agg(
              json_build_object('id', g.id, 'name', g.name)
              order by g.name, g.id
            )
            from student_guardians sg
            inner join guardians g on g.id = sg.guardian_id
            where sg.student_id = s.id
          ),
          '[]'::json
        ) as guardians
      from students s
      left join enrollments e
        on e.student_id = s.id
       and e.academic_period_id = (select id from active_period)
      left join classrooms c on c.id = e.classroom_id
      where ${scope}
    `);

    return result.rows;
  }

  async create(input: CreateStudentInput, executor: DbExecutor = this.db) {
    const result = await executor.execute<StudentRecord>(sql`
      insert into students (
        first_name,
        second_name,
        first_last_name,
        second_last_name,
        date_of_birth
      )
      values (
        ${input.firstName},
        ${input.secondName ?? null},
        ${input.firstLastName},
        ${input.secondLastName},
        ${input.dateOfBirth ?? null}
      )
      returning ${STUDENT_COLUMNS}
    `);

    return result.rows[0];
  }

  async update(input: UpdateStudentInput) {
    const assignments: SQL[] = [];

    if (input.firstName !== undefined) {
      assignments.push(sql`first_name = ${input.firstName}`);
    }

    if (input.secondName !== undefined) {
      assignments.push(sql`second_name = ${input.secondName ?? null}`);
    }

    if (input.firstLastName !== undefined) {
      assignments.push(sql`first_last_name = ${input.firstLastName}`);
    }

    if (input.secondLastName !== undefined) {
      assignments.push(sql`second_last_name = ${input.secondLastName}`);
    }

    if (input.dateOfBirth !== undefined) {
      assignments.push(sql`date_of_birth = ${input.dateOfBirth ?? null}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.studentId);
    }

    const result = await this.db.execute<StudentRecord>(sql`
      update students
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.studentId}
      returning ${STUDENT_COLUMNS}
    `);

    return result.rows[0] ?? null;
  }

  async delete(studentId: string) {
    const result = await this.db.execute<StudentRecord>(sql`
      delete from students
      where id = ${studentId}
      returning ${STUDENT_COLUMNS}
    `);

    return result.rows[0] ?? null;
  }

  async countEnrollments(studentId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from enrollments
      where student_id = ${studentId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  async findActiveAcademicPeriod(executor: DbExecutor = this.db) {
    const result = await executor.execute<AcademicPeriodRecord>(
      ACTIVE_PERIOD_QUERY
    );

    return result.rows[0] ?? null;
  }

  async findClassroom(classroomId: string, executor: DbExecutor = this.db) {
    const result = await executor.execute<ClassroomRecord>(sql`
      select id, grade_level as "gradeLevel", section
      from classrooms
      where id = ${classroomId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // Guardians are matched case-insensitively by email: a sibling's guardian
  // is the same person.
  async findGuardianByEmail(email: string, executor: DbExecutor = this.db) {
    const result = await executor.execute<GuardianRecord>(sql`
      select id, name, email
      from guardians
      where lower(email) = lower(${email})
      order by id
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async createGuardian(
    input: { name: string; email: string; phone?: string | null },
    executor: DbExecutor = this.db
  ) {
    const result = await executor.execute<GuardianRecord>(sql`
      insert into guardians (name, email, phone)
      values (${input.name}, ${input.email}, ${input.phone ?? null})
      returning id, name, email
    `);

    return result.rows[0];
  }

  async linkGuardian(
    studentId: string,
    guardianId: string,
    executor: DbExecutor = this.db
  ) {
    await executor.execute(sql`
      insert into student_guardians (student_id, guardian_id)
      values (${studentId}, ${guardianId})
    `);
  }

  async findUserByEmail(email: string, executor: DbExecutor = this.db) {
    const result = await executor.execute<UserAccountRecord>(sql`
      select users.id, user_roles.role
      from users
      left join user_roles on user_roles.user_id = users.id
      where lower(users.email) = lower(${email})
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async createParentUser(
    email: string,
    passwordHash: string,
    executor: DbExecutor = this.db
  ) {
    const result = await executor.execute<{ id: string }>(sql`
      insert into users (email, password_hash)
      values (${email}, ${passwordHash})
      returning id
    `);
    const userId = result.rows[0].id;

    await executor.execute(sql`
      insert into user_roles (user_id, role)
      values (${userId}, 'parent')
    `);

    return userId;
  }

  async linkGuardianUser(
    guardianId: string,
    userId: string,
    executor: DbExecutor = this.db
  ) {
    await executor.execute(sql`
      insert into guardian_user_links (guardian_id, user_id)
      values (${guardianId}, ${userId})
      on conflict do nothing
    `);
  }

  async createEnrollment(
    input: { studentId: string; academicPeriodId: string; classroomId: string },
    executor: DbExecutor = this.db
  ) {
    const result = await executor.execute<{ id: string }>(sql`
      insert into enrollments (student_id, academic_period_id, classroom_id, status)
      values (${input.studentId}, ${input.academicPeriodId}, ${input.classroomId}, 'active')
      returning id
    `);

    return result.rows[0].id;
  }

  private getSortColumn(sortBy: StudentSortColumn) {
    switch (sortBy) {
      case 'firstName':
        return sql.raw('first_name');
      case 'firstLastName':
        return sql.raw('first_last_name');
      case 'secondLastName':
        return sql.raw('second_last_name');
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
