import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type SubjectRecord = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  createdAt: Date | null;
};

export type TopicRecord = {
  id: string;
  subjectId: string;
  name: string;
  createdAt: Date | null;
};

// Qualified: the joins of the role-scoped queries bring their own id and
// created_at columns.
const SUBJECT_COLUMNS = sql`
  s.id,
  s.name,
  s.code,
  s.description,
  s.active,
  s.created_at as "createdAt"
`;

// Unqualified: an INSERT/UPDATE RETURNING has no alias to qualify with.
const RETURNING_COLUMNS = sql`
  id,
  name,
  code,
  description,
  active,
  created_at as "createdAt"
`;

export class SubjectsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // What an actor may see: an admin sees the whole catalog, a teacher the
  // materias assigned to them, a parent the materias their children study.
  async listForActor(role: string, actorId: string) {
    if (role === 'teacher') {
      const result = await this.db.execute<SubjectRecord>(sql`
        select ${SUBJECT_COLUMNS}
        from subjects s
        join subject_teachers st on st.subject_id = s.id
        where st.teacher_user_id = ${actorId}
        order by s.name asc
      `);

      return result.rows;
    }

    if (role === 'parent') {
      const result = await this.db.execute<SubjectRecord>(sql`
        select distinct ${SUBJECT_COLUMNS}
        from subjects s
        join classroom_subjects cs on cs.subject_id = s.id
        join enrollments e on e.classroom_id = cs.classroom_id
        join student_guardians sg on sg.student_id = e.student_id
        join guardian_user_links gul on gul.guardian_id = sg.guardian_id
        where gul.user_id = ${actorId}
        order by s.name asc
      `);

      return result.rows;
    }

    const result = await this.db.execute<SubjectRecord>(sql`
      select ${SUBJECT_COLUMNS}
      from subjects s
      order by s.name asc
    `);

    return result.rows;
  }

  async findById(subjectId: string) {
    const result = await this.db.execute<SubjectRecord>(sql`
      select ${SUBJECT_COLUMNS}
      from subjects s
      where s.id = ${subjectId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: {
    name: string;
    code?: string;
    description?: string;
  }) {
    const result = await this.db.execute<SubjectRecord>(sql`
      insert into subjects (name, code, description)
      values (${input.name}, ${input.code ?? null}, ${input.description ?? null})
      returning ${RETURNING_COLUMNS}
    `);

    return result.rows[0] ?? null;
  }

  async update(
    subjectId: string,
    input: {
      name?: string;
      code?: string;
      description?: string;
      active?: boolean;
    }
  ) {
    const assignments: SQL[] = [];

    if (input.name !== undefined) {
      assignments.push(sql`name = ${input.name}`);
    }

    if (input.code !== undefined) {
      assignments.push(sql`code = ${input.code}`);
    }

    if (input.description !== undefined) {
      assignments.push(sql`description = ${input.description}`);
    }

    if (input.active !== undefined) {
      assignments.push(sql`active = ${input.active}`);
    }

    if (assignments.length === 0) {
      return this.findById(subjectId);
    }

    const result = await this.db.execute<SubjectRecord>(sql`
      update subjects
      set ${sql.join(assignments, sql`, `)}
      where id = ${subjectId}
      returning ${RETURNING_COLUMNS}
    `);

    return result.rows[0] ?? null;
  }

  async listTopics(subjectId: string) {
    const result = await this.db.execute<TopicRecord>(sql`
      select
        id,
        subject_id as "subjectId",
        name,
        created_at as "createdAt"
      from topics
      where subject_id = ${subjectId}
      order by name asc
    `);

    return result.rows;
  }

  async createTopic(subjectId: string, name: string) {
    const result = await this.db.execute<TopicRecord>(sql`
      insert into topics (subject_id, name)
      values (${subjectId}, ${name})
      returning
        id,
        subject_id as "subjectId",
        name,
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async updateTopic(topicId: string, name: string) {
    const result = await this.db.execute<TopicRecord>(sql`
      update topics
      set name = ${name}
      where id = ${topicId}
      returning
        id,
        subject_id as "subjectId",
        name,
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async listClassroomSubjects(classroomId: string) {
    const result = await this.db.execute<SubjectRecord>(sql`
      select ${SUBJECT_COLUMNS}
      from subjects s
      join classroom_subjects cs on cs.subject_id = s.id
      where cs.classroom_id = ${classroomId}
      order by s.name asc
    `);

    return result.rows;
  }

  async assignClassroomSubject(classroomId: string, subjectId: string) {
    const result = await this.db.execute(sql`
      insert into classroom_subjects (classroom_id, subject_id)
      values (${classroomId}, ${subjectId})
      on conflict do nothing
      returning subject_id
    `);

    return result.rows.length > 0;
  }

  async removeClassroomSubject(classroomId: string, subjectId: string) {
    const result = await this.db.execute(sql`
      delete from classroom_subjects
      where classroom_id = ${classroomId} and subject_id = ${subjectId}
      returning subject_id
    `);

    return result.rows.length > 0;
  }

  async listTeacherSubjects(teacherUserId: string) {
    const result = await this.db.execute<SubjectRecord>(sql`
      select ${SUBJECT_COLUMNS}
      from subjects s
      join subject_teachers st on st.subject_id = s.id
      where st.teacher_user_id = ${teacherUserId}
      order by s.name asc
    `);

    return result.rows;
  }

  async assignTeacherSubject(teacherUserId: string, subjectId: string) {
    const result = await this.db.execute(sql`
      insert into subject_teachers (subject_id, teacher_user_id)
      values (${subjectId}, ${teacherUserId})
      on conflict do nothing
      returning subject_id
    `);

    return result.rows.length > 0;
  }

  async removeTeacherSubject(teacherUserId: string, subjectId: string) {
    const result = await this.db.execute(sql`
      delete from subject_teachers
      where teacher_user_id = ${teacherUserId} and subject_id = ${subjectId}
      returning subject_id
    `);

    return result.rows.length > 0;
  }
}
