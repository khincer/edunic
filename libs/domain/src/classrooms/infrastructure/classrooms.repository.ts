import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ListClassroomsQuery } from '../schemas/classroom.schemas.js';

type ClassroomSortColumn = ListClassroomsQuery['sortBy'];

type CountRow = {
  count: string | number;
};

export type ClassroomRecord = {
  id: string;
  institutionId: string;
  gradeLevel: number;
  section: string | null;
};

export type CreateClassroomInput = {
  institutionId: string;
  gradeLevel: number;
  section?: string | null;
};

export type UpdateClassroomInput = {
  institutionId: string;
  classroomId: string;
  gradeLevel?: number;
  section?: string | null;
};

export type ListClassroomsInput = ListClassroomsQuery & {
  institutionId: string;
  teacherUserId?: string;
};

export class ClassroomsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListClassroomsInput) {
    const filters: SQL[] = [sql`classrooms.institution_id = ${input.institutionId}`];
    const assignmentJoin = input.teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = classrooms.id
         and tca.institution_id = classrooms.institution_id
         and tca.teacher_user_id = ${input.teacherUserId}
      `
      : sql``;

    if (input.gradeLevel !== undefined) {
      filters.push(sql`classrooms.grade_level = ${input.gradeLevel}`);
    }

    if (input.section) {
      filters.push(sql`classrooms.section ilike ${`%${input.section}%`}`);
    }

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;

    const [items, totalRows] = await Promise.all([
      this.db.execute<ClassroomRecord>(sql`
        select
          classrooms.id,
          classrooms.institution_id as "institutionId",
          classrooms.grade_level as "gradeLevel",
          classrooms.section
        from classrooms
        ${assignmentJoin}
        ${whereClause}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}, section asc nulls last
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from classrooms
        ${assignmentJoin}
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(institutionId: string, classroomId: string) {
    const result = await this.db.execute<ClassroomRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        grade_level as "gradeLevel",
        section
      from classrooms
      where id = ${classroomId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findByGradeAndSection(
    institutionId: string,
    gradeLevel: number,
    section: string | null,
    excludeClassroomId?: string
  ) {
    const excludeClause = excludeClassroomId
      ? sql`and id <> ${excludeClassroomId}`
      : sql``;
    const sectionClause =
      section === null ? sql`section is null` : sql`section = ${section}`;

    const result = await this.db.execute<{ id: string }>(sql`
      select id
      from classrooms
      where institution_id = ${institutionId}
        and grade_level = ${gradeLevel}
        and ${sectionClause}
        ${excludeClause}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateClassroomInput) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into classrooms (
        institution_id,
        grade_level,
        section
      )
      values (
        ${input.institutionId},
        ${input.gradeLevel},
        ${input.section ?? null}
      )
      returning id
    `);

    return result.rows[0];
  }

  async update(input: UpdateClassroomInput) {
    const assignments: SQL[] = [];

    if (input.gradeLevel !== undefined) {
      assignments.push(sql`grade_level = ${input.gradeLevel}`);
    }

    if (input.section !== undefined) {
      assignments.push(sql`section = ${input.section}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.institutionId, input.classroomId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update classrooms
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.classroomId}
        and institution_id = ${input.institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, classroomId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from classrooms
      where id = ${classroomId}
        and institution_id = ${institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async countEnrollments(institutionId: string, classroomId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from enrollments
      where institution_id = ${institutionId}
        and classroom_id = ${classroomId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  private getSortColumn(sortBy: ClassroomSortColumn) {
    switch (sortBy) {
      case 'section':
        return sql.raw('section');
      default:
        return sql.raw('grade_level');
    }
  }

  private getSortOrder(sortOrder: ListClassroomsQuery['sortOrder']) {
    return sql.raw(sortOrder === 'desc' ? 'desc' : 'asc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
