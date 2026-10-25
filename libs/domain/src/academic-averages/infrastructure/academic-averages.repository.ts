import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

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
  constructor(private readonly db: NodePgDatabase) {}

  async findStudent(studentId: string) {
    const result = await this.db.execute<ExistsRow>(sql`
      select id
      from students
      where id = ${studentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listStudentGrades(studentId: string, year: number) {
    const result = await this.db.execute<StudentGradeRow>(sql`
      select
        subjects.name as subject,
        g.score,
        ap.id as "academicPeriodId",
        ap.year,
        ap.term
      from grades g
      inner join subjects on subjects.id = g.subject_id
      inner join enrollments e on e.id = g.enrollment_id
      inner join academic_periods ap on ap.id = e.academic_period_id
      where e.student_id = ${studentId}
        and ap.year = ${year}
      order by ap.term asc, subjects.name asc, g.created_at asc
    `);

    return result.rows;
  }
}
