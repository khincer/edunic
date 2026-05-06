import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

type Database = FastifyInstance['db'];

type ExistsRow = {
  id: string;
};

export type StudentGradeRow = {
  subject: string;
  score: number;
  academicPeriodId: string;
  year: number;
  term: number;
};

export class AcademicAveragesRepository {
  constructor(private readonly db: Database) {}

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

  async listStudentGrades(
    institutionId: string,
    studentId: string,
    year: number
  ) {
    const result = await this.db.execute<StudentGradeRow>(sql`
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
}
