import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  AttendanceStatus,
  ListAttendanceQuery,
} from '../schemas/attendance.schemas.js';

type Database = FastifyInstance['db'];

type AttendanceSortColumn = ListAttendanceQuery['sortBy'];

type CountRow = {
  count: string | number;
};

type ExistsRow = {
  id: string;
};

export type AttendanceRecord = {
  id: string;
  institutionId: string;
  enrollmentId: string;
  date: Date;
  status: AttendanceStatus;
  createdAt: Date | null;
};

export type CreateAttendanceInput = {
  institutionId: string;
  enrollmentId: string;
  date: string;
  status: AttendanceStatus;
};

export type UpdateAttendanceInput = {
  institutionId: string;
  attendanceId: string;
  date?: string;
  status?: AttendanceStatus;
};

export type ListAttendanceInput = ListAttendanceQuery & {
  institutionId: string;
};

export class AttendanceRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListAttendanceInput) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.enrollmentId) {
      filters.push(sql`enrollment_id = ${input.enrollmentId}`);
    }

    if (input.status) {
      filters.push(sql`status = ${input.status}`);
    }

    if (input.date) {
      filters.push(sql`date::date = ${input.date}::date`);
    }

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;

    const [items, totalRows] = await Promise.all([
      this.db.execute<AttendanceRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          enrollment_id as "enrollmentId",
          date,
          status,
          created_at as "createdAt"
        from attendance
        ${whereClause}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
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

  async findById(institutionId: string, attendanceId: string) {
    const result = await this.db.execute<AttendanceRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        enrollment_id as "enrollmentId",
        date,
        status,
        created_at as "createdAt"
      from attendance
      where id = ${attendanceId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateAttendanceInput) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into attendance (
        institution_id,
        enrollment_id,
        date,
        status
      )
      values (
        ${input.institutionId},
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
      return this.findById(input.institutionId, input.attendanceId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update attendance
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.attendanceId}
        and institution_id = ${input.institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, attendanceId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from attendance
      where id = ${attendanceId}
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
