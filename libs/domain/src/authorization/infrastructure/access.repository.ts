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

  // A teacher owns a materia when it is assigned to them or when it is
  // offered in one of their classrooms.
  async isTeacherOwnsSubject(teacherUserId: string, subjectId: string) {
    const result = await this.db.execute(sql`
      select 1
      from subject_teachers st
      where st.teacher_user_id = ${teacherUserId}
        and st.subject_id = ${subjectId}
      union
      select 1
      from classroom_subjects cs
      join teacher_classroom_assignments tca on tca.classroom_id = cs.classroom_id
      where tca.teacher_user_id = ${teacherUserId}
        and cs.subject_id = ${subjectId}
      limit 1
    `);

    return result.rows.length > 0;
  }

  // The students a parent account is linked to.
  async listParentStudentIds(parentUserId: string) {
    const result = await this.db.execute<{ studentId: string }>(sql`
      select distinct sg.student_id as "studentId"
      from guardian_user_links gul
      inner join student_guardians sg on sg.guardian_id = gul.guardian_id
      where gul.user_id = ${parentUserId}
    `);

    return result.rows.map((row) => row.studentId);
  }

  async isParentOwnsStudent(parentUserId: string, studentId: string) {
    const result = await this.db.execute(sql`
      select 1
      from guardian_user_links gul
      inner join student_guardians sg on sg.guardian_id = gul.guardian_id
      where gul.user_id = ${parentUserId}
        and sg.student_id = ${studentId}
      limit 1
    `);

    return result.rows.length > 0;
  }

  // A teacher teaches a student when the student is enrolled in one of the
  // teacher's classrooms.
  async isTeacherTeachesStudent(teacherUserId: string, studentId: string) {
    const result = await this.db.execute(sql`
      select 1
      from enrollments e
      inner join teacher_classroom_assignments tca
        on tca.classroom_id = e.classroom_id
      where tca.teacher_user_id = ${teacherUserId}
        and e.student_id = ${studentId}
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
