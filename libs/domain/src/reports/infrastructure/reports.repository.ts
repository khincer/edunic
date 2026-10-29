import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildStudentIdCondition,
  type CursorOrderSpec,
} from '@edunic/source/domain/shared';
import type {
  ExportGradesCsvQuery,
  ListReportHistoryQuery,
} from '../schemas/reports.schemas.js';

// Stable keyset order for the history list: newest first, the uuid closing the
// order because two exports can share a created_at. Qualified: the list joins
// students, which has both columns too.
export const REPORT_HISTORY_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['report_history.created_at', 'report_history.id'],
  direction: 'desc',
};

export type StudentReportStudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
};

export type StudentReportGradeRow = {
  subject: string;
  score: number;
  academicPeriodId: string;
  year: number;
  term: number;
};

export type StudentReportEnrollmentRow = {
  enrollmentId: string;
  academicPeriodId: string;
  term: number;
  enrollmentStatus: string | null;
  promotionStatus: string | null;
};

export type ReportHistoryRecord = {
  id: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  year: number;
  reportType: string;
  createdByUserId: string | null;
  createdAt: Date | null;
};

export type RecordReportExportInput = {
  studentId: string;
  year: number;
  reportType: string;
  createdByUserId: string;
};

export type ListReportHistoryInput = ListReportHistoryQuery & {
  // Restricts the list to these students; undefined means unscoped.
  studentIds?: string[];
};

export type GradeExportRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  gradeLevel: number | null;
  section: string | null;
  year: number;
  term: number;
  subject: string;
  score: number;
};

export type ListGradesForExportInput = ExportGradesCsvQuery & {
  // Restricts the export to these students; undefined means unscoped.
  studentIds?: string[];
};

type CountRow = {
  count: string | number;
};

export class ReportsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findStudent(studentId: string) {
    const result = await this.db.execute<StudentReportStudentRow>(sql`
      select
        id,
        first_name as "firstName",
        concat_ws(' ', first_last_name, second_last_name) as "lastName",
        date_of_birth as "dateOfBirth"
      from students
      where id = ${studentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listStudentGrades(studentId: string, year: number) {
    const result = await this.db.execute<StudentReportGradeRow>(sql`
      select
        s.name as subject,
        g.score,
        ap.id as "academicPeriodId",
        ap.year,
        ap.term
      from grades g
      inner join subjects s
        on s.id = g.subject_id
      inner join enrollments e
        on e.id = g.enrollment_id
      inner join academic_periods ap
        on ap.id = e.academic_period_id
      where e.student_id = ${studentId}
        and ap.year = ${year}
      order by ap.term asc, s.name asc, g.created_at asc
    `);

    return result.rows;
  }

  async listStudentEnrollments(studentId: string, year: number) {
    const result = await this.db.execute<StudentReportEnrollmentRow>(sql`
      select
        e.id as "enrollmentId",
        ap.id as "academicPeriodId",
        ap.term,
        e.status as "enrollmentStatus",
        e.promotion_status as "promotionStatus"
      from enrollments e
      inner join academic_periods ap
        on ap.id = e.academic_period_id
      where e.student_id = ${studentId}
        and ap.year = ${year}
      order by ap.term asc, e.created_at asc
    `);

    return result.rows;
  }

  async recordExport(input: RecordReportExportInput) {
    await this.recordExports([input]);
  }

  async recordExports(inputs: RecordReportExportInput[]) {
    if (inputs.length === 0) {
      return;
    }

    await this.db.execute(sql`
      insert into report_history (student_id, year, report_type, created_by_user_id)
      values ${sql.join(
        inputs.map(
          (input) => sql`(
            ${input.studentId},
            ${input.year},
            ${input.reportType},
            ${input.createdByUserId}
          )`
        ),
        sql`, `
      )}
    `);
  }

  // One row per grade of the year, in a stable order: student, term, materia.
  async listGradesForExport(input: ListGradesForExportInput) {
    const filters: SQL[] = [sql`ap.year = ${input.year}`];
    const scope = buildStudentIdCondition('e.student_id', input.studentIds);

    if (scope) {
      filters.push(scope);
    }

    if (input.studentId) {
      filters.push(sql`e.student_id = ${input.studentId}`);
    }

    if (input.classroomId) {
      filters.push(sql`e.classroom_id = ${input.classroomId}`);
    }

    const result = await this.db.execute<GradeExportRow>(sql`
      select
        st.id as "studentId",
        st.first_name as "firstName",
        concat_ws(' ', st.first_last_name, st.second_last_name) as "lastName",
        c.grade_level as "gradeLevel",
        c.section,
        ap.year,
        ap.term,
        s.name as subject,
        g.score
      from grades g
      inner join enrollments e
        on e.id = g.enrollment_id
      inner join students st
        on st.id = e.student_id
      inner join academic_periods ap
        on ap.id = e.academic_period_id
      inner join subjects s
        on s.id = g.subject_id
      left join classrooms c
        on c.id = e.classroom_id
      where ${sql.join(filters, sql` and `)}
      order by
        st.first_last_name asc,
        st.second_last_name asc,
        st.first_name asc,
        st.id asc,
        ap.term asc,
        s.name asc,
        g.created_at asc,
        g.id asc
    `);

    return result.rows;
  }

  async listHistory(input: ListReportHistoryInput) {
    const filters: SQL[] = [];
    const scope = buildStudentIdCondition(
      'report_history.student_id',
      input.studentIds
    );

    if (scope) {
      filters.push(scope);
    }

    if (input.studentId) {
      filters.push(sql`report_history.student_id = ${input.studentId}`);
    }

    if (input.year !== undefined) {
      filters.push(sql`report_history.year = ${input.year}`);
    }

    const plan = applyCursorPagination(input, REPORT_HISTORY_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause =
      filters.length > 0
        ? sql`where ${sql.join(filters, sql` and `)}`
        : sql``;
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        report_history.id,
        report_history.student_id as "studentId",
        students.first_name as "studentFirstName",
        concat_ws(' ', students.first_last_name, students.second_last_name) as "studentLastName",
        report_history.year,
        report_history.report_type as "reportType",
        report_history.created_by_user_id as "createdByUserId",
        report_history.created_at as "createdAt"
      from report_history
      inner join students
        on students.id = report_history.student_id
      ${whereClause}
      order by report_history.created_at desc, report_history.id desc
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<ReportHistoryRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<ReportHistoryRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from report_history
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: Number(totalRows.rows[0]?.count ?? 0),
    };
  }
}
