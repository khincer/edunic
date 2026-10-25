import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

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

export class ReportsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async findStudent(studentId: string) {
    const result = await this.db.execute<StudentReportStudentRow>(sql`
      select
        id,
        first_name as "firstName",
        last_name as "lastName",
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
}
