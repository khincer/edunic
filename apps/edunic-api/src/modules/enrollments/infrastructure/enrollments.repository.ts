import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  EnrollmentStatus,
  ListEnrollmentsQuery,
} from '../schemas/enrollment.schemas.js';

type Database = FastifyInstance['db'];

type EnrollmentSortColumn = ListEnrollmentsQuery['sortBy'];

type CountRow = {
  count: string | number;
};

type ExistsRow = {
  id: string;
};

type AverageRow = {
  average: string | number | null;
  gradeCount: string | number;
};

export type EnrollmentRecord = {
  id: string;
  institutionId: string;
  studentId: string;
  academicPeriodId: string;
  classroomId: string | null;
  status: EnrollmentStatus;
  promotionStatus: string | null;
  createdAt: Date | null;
  studentFirstName: string;
  studentLastName: string;
};

export type CreateEnrollmentInput = {
  institutionId: string;
  studentId: string;
  academicPeriodId: string;
  classroomId?: string | null;
  status: EnrollmentStatus;
  promotionStatus?: string | null;
};

export type UpdateEnrollmentInput = {
  institutionId: string;
  enrollmentId: string;
  classroomId?: string | null;
  status?: EnrollmentStatus;
  promotionStatus?: string | null;
};

export type ListEnrollmentsInput = ListEnrollmentsQuery & {
  institutionId: string;
};

export class EnrollmentsRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListEnrollmentsInput) {
    const filters: SQL[] = [sql`e.institution_id = ${input.institutionId}`];

    if (input.search) {
      filters.push(sql`(
        s.first_name ilike ${`%${input.search}%`}
        or s.last_name ilike ${`%${input.search}%`}
      )`);
    }

    if (input.studentId) {
      filters.push(sql`e.student_id = ${input.studentId}`);
    }

    if (input.academicPeriodId) {
      filters.push(sql`e.academic_period_id = ${input.academicPeriodId}`);
    }

    if (input.classroomId) {
      filters.push(sql`e.classroom_id = ${input.classroomId}`);
    }

    if (input.status) {
      filters.push(sql`e.status = ${input.status}`);
    }

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;

    const [items, totalRows] = await Promise.all([
      this.db.execute<EnrollmentRecord>(sql`
        select
          e.id,
          e.institution_id as "institutionId",
          e.student_id as "studentId",
          e.academic_period_id as "academicPeriodId",
          e.classroom_id as "classroomId",
          e.status,
          e.promotion_status as "promotionStatus",
          e.created_at as "createdAt",
          s.first_name as "studentFirstName",
          s.last_name as "studentLastName"
        from enrollments e
        inner join students s on s.id = e.student_id
        ${whereClause}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from enrollments e
        inner join students s on s.id = e.student_id
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(institutionId: string, enrollmentId: string) {
    const result = await this.db.execute<EnrollmentRecord>(sql`
      select
        e.id,
        e.institution_id as "institutionId",
        e.student_id as "studentId",
        e.academic_period_id as "academicPeriodId",
        e.classroom_id as "classroomId",
        e.status,
        e.promotion_status as "promotionStatus",
        e.created_at as "createdAt",
        s.first_name as "studentFirstName",
        s.last_name as "studentLastName"
      from enrollments e
      inner join students s on s.id = e.student_id
      where e.id = ${enrollmentId}
        and e.institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateEnrollmentInput) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into enrollments (
        institution_id,
        student_id,
        academic_period_id,
        classroom_id,
        status,
        promotion_status
      )
      values (
        ${input.institutionId},
        ${input.studentId},
        ${input.academicPeriodId},
        ${input.classroomId ?? null},
        ${input.status},
        ${input.promotionStatus ?? null}
      )
      returning id
    `);

    return result.rows[0];
  }

  async update(input: UpdateEnrollmentInput) {
    const assignments: SQL[] = [];

    if (input.classroomId !== undefined) {
      assignments.push(sql`classroom_id = ${input.classroomId}`);
    }

    if (input.status !== undefined) {
      assignments.push(sql`status = ${input.status}`);
    }

    if (input.promotionStatus !== undefined) {
      assignments.push(sql`promotion_status = ${input.promotionStatus}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.institutionId, input.enrollmentId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update enrollments
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.enrollmentId}
        and institution_id = ${input.institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, enrollmentId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from enrollments
      where id = ${enrollmentId}
        and institution_id = ${institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async findStudent(institutionId: string, studentId: string) {
    const result = await this.db.execute<ExistsRow>(sql`
      select id
      from students
      where id = ${studentId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findAcademicPeriod(institutionId: string, academicPeriodId: string) {
    const result = await this.db.execute<ExistsRow>(sql`
      select id
      from academic_periods
      where id = ${academicPeriodId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findClassroom(institutionId: string, classroomId: string) {
    const result = await this.db.execute<ExistsRow>(sql`
      select id
      from classrooms
      where id = ${classroomId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async countGrades(institutionId: string, enrollmentId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from grades
      where institution_id = ${institutionId}
        and enrollment_id = ${enrollmentId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  async countAttendance(institutionId: string, enrollmentId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from attendance
      where institution_id = ${institutionId}
        and enrollment_id = ${enrollmentId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  async getEnrollmentAverage(institutionId: string, enrollmentId: string) {
    const result = await this.db.execute<AverageRow>(sql`
      select
        avg(score)::numeric(10,2) as average,
        count(*)::int as "gradeCount"
      from grades
      where institution_id = ${institutionId}
        and enrollment_id = ${enrollmentId}
    `);

    const row = result.rows[0];

    return {
      average:
        row?.average === null || row?.average === undefined
          ? null
          : Number(row.average),
      gradeCount: this.toCount(row?.gradeCount),
    };
  }

  private getSortColumn(sortBy: EnrollmentSortColumn) {
    switch (sortBy) {
      case 'status':
        return sql.raw('e.status');
      case 'studentName':
        return sql.raw('s.last_name, s.first_name');
      default:
        return sql.raw('e.created_at');
    }
  }

  private getSortOrder(sortOrder: ListEnrollmentsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'asc' ? 'asc' : 'desc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
