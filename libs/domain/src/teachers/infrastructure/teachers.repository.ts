import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type TeacherRecord = {
  id: string;
  email: string;
  role: string;
  createdAt: Date | null;
};

export type TeacherClassroomRecord = {
  classroomId: string;
  gradeLevel: number;
  section: string | null;
};

export class TeachersRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(role: string) {
    const result = await this.db.execute<TeacherRecord>(sql`
      select
        u.id,
        u.email,
        r.role,
        u.created_at as "createdAt"
      from users u
      join user_roles r on r.user_id = u.id
      where r.role = ${role}
      order by u.email asc
    `);

    return result.rows;
  }

  async findById(userId: string) {
    const result = await this.db.execute<TeacherRecord>(sql`
      select
        u.id,
        u.email,
        r.role,
        u.created_at as "createdAt"
      from users u
      join user_roles r on r.user_id = u.id
      where u.id = ${userId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findByEmail(email: string) {
    const result = await this.db.execute<TeacherRecord>(sql`
      select
        u.id,
        u.email,
        r.role,
        u.created_at as "createdAt"
      from users u
      join user_roles r on r.user_id = u.id
      where lower(u.email) = lower(${email})
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    role: string;
  }) {
    const result = await this.db.execute<TeacherRecord>(sql`
      insert into users (email, password_hash)
      values (${input.email}, ${input.passwordHash})
      on conflict (email) do nothing
      returning
        id,
        email,
        created_at as "createdAt"
    `);

    const user = result.rows[0];

    if (!user) {
      return null;
    }

    await this.db.execute(sql`
      insert into user_roles (user_id, role)
      values (${user.id}, ${input.role})
      on conflict (user_id) do nothing
    `);

    return { ...user, role: input.role };
  }

  async updateRole(userId: string, role: string) {
    const result = await this.db.execute<TeacherRecord>(sql`
      update user_roles
      set role = ${role}
      where user_id = ${userId}
      returning
        user_id as id,
        role,
        (select email from users where id = ${userId}) as email,
        (select created_at from users where id = ${userId}) as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async listClassrooms(userId: string) {
    const result = await this.db.execute<TeacherClassroomRecord>(sql`
      select
        c.id as "classroomId",
        c.grade_level as "gradeLevel",
        c.section
      from teacher_classroom_assignments tca
      join classrooms c on c.id = tca.classroom_id
      where tca.teacher_user_id = ${userId}
      order by c.grade_level asc, c.section asc nulls last
    `);

    return result.rows;
  }

  async classroomExists(classroomId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      select id from classrooms where id = ${classroomId} limit 1
    `);

    return result.rows[0] ?? null;
  }

  async assignClassroom(userId: string, classroomId: string) {
    const result = await this.db.execute(sql`
      insert into teacher_classroom_assignments (institution_id, teacher_user_id, classroom_id)
      select c.institution_id, ${userId}, c.id
      from classrooms c
      where c.id = ${classroomId}
      on conflict do nothing
      returning classroom_id
    `);

    return result.rows.length > 0;
  }

  async unassignClassroom(userId: string, classroomId: string) {
    const result = await this.db.execute(sql`
      delete from teacher_classroom_assignments
      where teacher_user_id = ${userId} and classroom_id = ${classroomId}
      returning classroom_id
    `);

    return result.rows.length > 0;
  }
}
