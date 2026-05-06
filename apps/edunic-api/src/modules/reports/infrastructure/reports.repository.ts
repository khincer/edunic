import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

type Database = FastifyInstance['db'];

export type StudentReportStudentRow = {
  id: string;
  institutionId: string;
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

export class ReportsRepository {
  constructor(private readonly db: Database) {}

  async findStudent(institutionId: string, studentId: string) {
    const result = await this.db.execute<StudentReportStudentRow>(sql`
      select
        id,
        institution_id as "institutionId",
        first_name as "firstName",
        last_name as "lastName",
        date_of_birth as "dateOfBirth"
      from students
      where id = ${studentId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listStudentGrades(
    institutionId: string,
    studentId: string,
    year: number
  ) {
    const result = await this.db.execute<StudentReportGradeRow>(sql`
      select
        g.subject,
        g.score,
        ap.id as "academicPeriodId",
        ap.year,
        ap.term
      from grades g
      inner join enrollments e
        on e.id = g.enrollment_id
       and e.institution_id = g.institution_id
      inner join academic_periods ap
        on ap.id = e.academic_period_id
       and ap.institution_id = e.institution_id
      where g.institution_id = ${institutionId}
        and e.student_id = ${studentId}
        and ap.year = ${year}
      order by ap.term asc, g.subject asc, g.created_at asc
    `);

    return result.rows;
  }

  async listStudentEnrollments(
    institutionId: string,
    studentId: string,
    year: number
  ) {
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
       and ap.institution_id = e.institution_id
      where e.institution_id = ${institutionId}
        and e.student_id = ${studentId}
        and ap.year = ${year}
      order by ap.term asc, e.created_at asc
    `);

    return result.rows;
  }
}
