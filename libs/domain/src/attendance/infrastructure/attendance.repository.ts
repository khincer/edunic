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
import type {
  AttendanceStatus,
  ListAttendanceQuery,
} from '../schemas/attendance.schemas.js';

type AttendanceSortColumn = ListAttendanceQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): date, id.
export const ATTENDANCE_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['date', 'id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const ATTENDANCE_LIST_COLUMNS = {
  status: 'status',
  date: 'date',
  enrollmentId: 'enrollment_id',
  createdAt: 'created_at',
} as const;

// The student an attendance record belongs to, through its enrollment.
// Constant literal.
const ATTENDANCE_STUDENT_ID =
  '(select e.student_id from enrollments e where e.id = attendance.enrollment_id)';

type CountRow = {
  count: string | number;
};

type ExistsRow = {
  id: string;
};

export type AttendanceRecord = {
  id: string;
  enrollmentId: string;
  date: Date;
  status: AttendanceStatus;
  createdAt: Date | null;
};

export type CreateAttendanceInput = {
  enrollmentId: string;
  date: string;
  status: AttendanceStatus;
};

export type UpdateAttendanceInput = {
  attendanceId: string;
  date?: string;
  status?: AttendanceStatus;
};

export type ListAttendanceInput = ListAttendanceQuery & {
  // Restricts the list to these students; undefined means unscoped.
  studentIds?: string[];
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListAttendanceResult = {
  items: AttendanceRecord[];
  total?: number;
};

export class AttendanceRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // D2: services wrap the domain write, the outbox insert and the event
  // publish in one transaction so they commit or roll back together.
  async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async list(input: ListAttendanceInput): Promise<ListAttendanceResult> {
    const filters: SQL[] = [];
    const scope = buildStudentIdCondition(
      ATTENDANCE_STUDENT_ID,
      input.studentIds
    );

    if (scope) {
      filters.push(scope);
    }

    if (input.enrollmentId) {
      filters.push(sql`enrollment_id = ${input.enrollmentId}`);
    }

    if (input.status) {
      filters.push(sql`status = ${input.status}`);
    }

    if (input.date) {
      filters.push(sql`date::date = ${input.date}::date`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], ATTENDANCE_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, ATTENDANCE_CURSOR_ORDER);

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
        enrollment_id as "enrollmentId",
        date,
        status,
        created_at as "createdAt"
      from attendance
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<AttendanceRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<AttendanceRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from attendance
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(attendanceId: string, executor: DbExecutor = this.db) {
    const result = await executor.execute<AttendanceRecord>(sql`
      select
        id,
        enrollment_id as "enrollmentId",
        date,
        status,
        created_at as "createdAt"
      from attendance
      where id = ${attendanceId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateAttendanceInput, executor: DbExecutor = this.db) {
    const result = await executor.execute<{ id: string }>(sql`
      insert into attendance (
        enrollment_id,
        date,
        status
      )
      values (
        ${input.enrollmentId},
        ${input.date},
        ${input.status}
      )
      returning id
    `);

    return result.rows[0];
  }

  async update(input: UpdateAttendanceInput) {
    const assignments: SQL[] = [];

    if (input.date !== undefined) {
      assignments.push(sql`date = ${input.date}`);
    }

    if (input.status !== undefined) {
      assignments.push(sql`status = ${input.status}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.attendanceId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update attendance
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.attendanceId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(attendanceId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from attendance
      where id = ${attendanceId}
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

  private getSortColumn(sortBy: AttendanceSortColumn) {
    switch (sortBy) {
      case 'createdAt':
        return sql.raw('created_at');
      case 'status':
        return sql.raw('status');
      default:
        return sql.raw('date');
    }
  }

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListAttendanceInput): SQL {
    const standardSort = buildSortSql(input.sort ?? null, ATTENDANCE_LIST_COLUMNS);

    return (
      standardSort ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}`
    );
  }

  private getSortOrder(sortOrder: ListAttendanceQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
