import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildSortSql,
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListClassroomsQuery } from '../schemas/classroom.schemas.js';

type ClassroomSortColumn = ListClassroomsQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): grade_level asc, id asc.
// Qualified because the list query joins teacher_classroom_assignments.
export const CLASSROOM_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['classrooms.grade_level', 'classrooms.id'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const CLASSROOM_LIST_COLUMNS = {
  gradeLevel: 'classrooms.grade_level',
  section: 'classrooms.section',
} as const;

type CountRow = {
  count: string | number;
};

export type ClassroomRecord = {
  id: string;
  gradeLevel: number;
  section: string | null;
};

export type CreateClassroomInput = {
  gradeLevel: number;
  section?: string | null;
};

export type UpdateClassroomInput = {
  classroomId: string;
  gradeLevel?: number;
  section?: string | null;
};

export type ListClassroomsInput = ListClassroomsQuery & {
  teacherUserId?: string;
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListClassroomsResult = {
  items: ClassroomRecord[];
  total?: number;
};

export class ClassroomsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListClassroomsInput): Promise<ListClassroomsResult> {
    const filters: SQL[] = [sql`true`];
    const assignmentJoin = input.teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = classrooms.id
         and tca.teacher_user_id = ${input.teacherUserId}
      `
      : sql``;

    if (input.gradeLevel !== undefined) {
      filters.push(sql`classrooms.grade_level = ${input.gradeLevel}`);
    }

    if (input.section) {
      filters.push(sql`classrooms.section ilike ${`%${input.section}%`}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], CLASSROOM_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, CLASSROOM_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause = sql`where ${sql.join(filters, sql` and `)}`;
    const orderBy = plan.orderBy ?? this.legacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        classrooms.id,
        classrooms.grade_level as "gradeLevel",
        classrooms.section
      from classrooms
      ${assignmentJoin}
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<ClassroomRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<ClassroomRecord>(itemsQuery),
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

  async findById(classroomId: string) {
    const result = await this.db.execute<ClassroomRecord>(sql`
      select
        id,
        grade_level as "gradeLevel",
        section
      from classrooms
      where id = ${classroomId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findByGradeAndSection(
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
      where grade_level = ${gradeLevel}
        and ${sectionClause}
        ${excludeClause}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateClassroomInput) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into classrooms (
        grade_level,
        section
      )
      values (
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
      return this.findById(input.classroomId);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update classrooms
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.classroomId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async delete(classroomId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      delete from classrooms
      where id = ${classroomId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async countEnrollments(classroomId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from enrollments
      where classroom_id = ${classroomId}
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

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListClassroomsInput): SQL {
    const standardSort = buildSortSql(
      input.sort ?? null,
      CLASSROOM_LIST_COLUMNS
    );

    return (
      standardSort ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}, section asc nulls last`
    );
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
