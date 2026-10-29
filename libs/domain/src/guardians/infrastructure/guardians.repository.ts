import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildStudentIdCondition,
  buildSortSql,
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListGuardiansQuery } from '../schemas/guardian.schemas.js';

type GuardianSortColumn = ListGuardiansQuery['sortBy'];

// Stable keyset order for cursor pagination (P2-R4): name asc, id asc. Name is
// not unique, so the uuid `id` closes the order; no timestamp column exists.
export const GUARDIAN_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['name', 'id'],
  direction: 'asc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const GUARDIAN_LIST_COLUMNS = {
  name: 'name',
  phone: 'phone',
  email: 'email',
} as const;

type CountRow = {
  count: string | number;
};

export type GuardianRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type StudentRecord = {
  id: string;
  firstName: string;
  lastName: string;
};

export type CreateGuardianInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type UpdateGuardianInput = {
  guardianId: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
};

export type ListGuardiansInput = ListGuardiansQuery & {
  // Restricts the list to guardians of these students; undefined means
  // unscoped.
  studentIds?: string[];
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export type ListGuardiansResult = {
  items: GuardianRecord[];
  total?: number;
};

export class GuardiansRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListGuardiansInput): Promise<ListGuardiansResult> {
    const filters: SQL[] = [];

    const scope = buildStudentIdCondition('student_id', input.studentIds);

    if (scope) {
      filters.push(
        sql`id in (select guardian_id from student_guardians where ${scope})`
      );
    }

    if (input.search) {
      filters.push(
        sql`(name ilike ${`%${input.search}%`} or coalesce(phone, '') ilike ${`%${input.search}%`})`
      );
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], GUARDIAN_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, GUARDIAN_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause =
      filters.length > 0
        ? sql`where ${sql.join(filters, sql` and `)}`
        : sql``;
    const orderBy = plan.orderBy ?? this.legacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        id,
        name,
        phone,
        email
      from guardians
      ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<GuardianRecord>(itemsQuery);
      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<GuardianRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from guardians
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(guardianId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      select
        id,
        name,
        phone,
        email
      from guardians
      where id = ${guardianId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateGuardianInput) {
    const result = await this.db.execute<GuardianRecord>(sql`
      insert into guardians (
        name,
        phone,
        email
      )
      values (
        ${input.name},
        ${input.phone ?? null},
        ${input.email ?? null}
      )
      returning
        id,
        name,
        phone,
        email
    `);

    return result.rows[0];
  }

  async update(input: UpdateGuardianInput) {
    const assignments: SQL[] = [];

    if (input.name !== undefined) {
      assignments.push(sql`name = ${input.name}`);
    }

    if (input.phone !== undefined) {
      assignments.push(sql`phone = ${input.phone ?? null}`);
    }

    if (input.email !== undefined) {
      assignments.push(sql`email = ${input.email ?? null}`);
    }

    if (assignments.length === 0) {
      return this.findById(input.guardianId);
    }

    const result = await this.db.execute<GuardianRecord>(sql`
      update guardians
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.guardianId}
      returning
        id,
        name,
        phone,
        email
    `);

    return result.rows[0] ?? null;
  }

  async delete(guardianId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      delete from guardians
      where id = ${guardianId}
      returning
        id,
        name,
        phone,
        email
    `);

    return result.rows[0] ?? null;
  }

  async findStudentById(studentId: string) {
    const result = await this.db.execute<StudentRecord>(sql`
      select
        id,
        first_name as "firstName",
        concat_ws(' ', first_last_name, second_last_name) as "lastName"
      from students
      where id = ${studentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listStudentGuardians(studentId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      select
        guardians.id,
        guardians.name,
        guardians.phone,
        guardians.email
      from student_guardians
      inner join guardians
        on guardians.id = student_guardians.guardian_id
      inner join students
        on students.id = student_guardians.student_id
      where student_guardians.student_id = ${studentId}
      order by guardians.name asc
    `);

    return result.rows;
  }

  async findStudentGuardianLink(studentId: string, guardianId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      select
        guardians.id,
        guardians.name,
        guardians.phone,
        guardians.email
      from student_guardians
      inner join guardians
        on guardians.id = student_guardians.guardian_id
      inner join students
        on students.id = student_guardians.student_id
      where student_guardians.student_id = ${studentId}
        and student_guardians.guardian_id = ${guardianId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async addGuardianToStudent(studentId: string, guardianId: string) {
    await this.db.execute(sql`
      insert into student_guardians (
        student_id,
        guardian_id
      )
      values (
        ${studentId},
        ${guardianId}
      )
    `);
  }

  async removeGuardianFromStudent(studentId: string, guardianId: string) {
    await this.db.execute(sql`
      delete from student_guardians
      where student_id = ${studentId}
        and guardian_id = ${guardianId}
    `);
  }

  async countLinkedStudents(guardianId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from student_guardians
      where guardian_id = ${guardianId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  // The standard `sort` param wins over the legacy sortBy/sortOrder pair;
  // cursor mode never reaches here (stable order wins).
  private legacyOrderBy(input: ListGuardiansInput): SQL {
    return (
      buildSortSql(input.sort ?? null, GUARDIAN_LIST_COLUMNS) ??
      sql`${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}`
    );
  }

  private getSortColumn(sortBy: GuardianSortColumn) {
    switch (sortBy) {
      case 'phone':
        return sql.raw('phone');
      case 'email':
        return sql.raw('email');
      default:
        return sql.raw('name');
    }
  }

  private getSortOrder(sortOrder: ListGuardiansQuery['sortOrder']) {
    return sql.raw(sortOrder === 'desc' ? 'desc' : 'asc');
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
