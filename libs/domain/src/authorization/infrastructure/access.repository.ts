import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class AccessRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async isTeacherAssignedToClassroom(
    teacherUserId: string,
    classroomId: string
  ) {
    const result = await this.db.execute(sql`
      select 1
      from teacher_classroom_assignments
      where teacher_user_id = ${teacherUserId}
        and classroom_id = ${classroomId}
      limit 1
    `);

    return result.rows.length > 0;
  }

  // The classroom an enrollment belongs to. NULL means the student is not in
  // a classroom, so no teacher owns that record.
  async findEnrollmentClassroomId(enrollmentId: string) {
    const result = await this.db.execute<{ classroomId: string | null }>(sql`
      select classroom_id as "classroomId"
      from enrollments
      where id = ${enrollmentId}
      limit 1
    `);

    return result.rows[0]?.classroomId ?? null;
  }
}
