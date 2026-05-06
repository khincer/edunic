import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ListGuardiansQuery } from '../schemas/guardian.schemas.js';

type Database = FastifyInstance['db'];

type GuardianSortColumn = ListGuardiansQuery['sortBy'];

type CountRow = {
  count: string | number;
};

export type GuardianRecord = {
  id: string;
  institutionId: string;
  name: string;
  phone: string | null;
};

export type StudentRecord = {
  id: string;
  institutionId: string;
  firstName: string;
  lastName: string;
};

export type CreateGuardianInput = {
  institutionId: string;
  name: string;
  phone?: string | null;
};

export type UpdateGuardianInput = {
  institutionId: string;
  guardianId: string;
  name?: string;
  phone?: string | null;
};

export type ListGuardiansInput = ListGuardiansQuery & {
  institutionId: string;
};

export class GuardiansRepository {
  constructor(private readonly db: Database) {}

  async list(input: ListGuardiansInput) {
    const searchFilter = input.search
      ? sql`and (
          name ilike ${`%${input.search}%`}
          or coalesce(phone, '') ilike ${`%${input.search}%`}
        )`
      : sql``;

    const [items, totalRows] = await Promise.all([
      this.db.execute<GuardianRecord>(sql`
        select
          id,
          institution_id as "institutionId",
          name,
          phone
        from guardians
        where institution_id = ${input.institutionId}
        ${searchFilter}
        order by ${this.getSortColumn(input.sortBy)} ${this.getSortOrder(input.sortOrder)}
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from guardians
        where institution_id = ${input.institutionId}
        ${searchFilter}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async findById(institutionId: string, guardianId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        name,
        phone
      from guardians
      where id = ${guardianId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: CreateGuardianInput) {
    const result = await this.db.execute<GuardianRecord>(sql`
      insert into guardians (
        institution_id,
        name,
        phone
      )
      values (
        ${input.institutionId},
        ${input.name},
        ${input.phone ?? null}
      )
      returning
        id,
        institution_id as "institutionId",
        name,
        phone
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

    if (assignments.length === 0) {
      return this.findById(input.institutionId, input.guardianId);
    }

    const result = await this.db.execute<GuardianRecord>(sql`
      update guardians
      set ${sql.join(assignments, sql`, `)}
      where id = ${input.guardianId}
        and institution_id = ${input.institutionId}
      returning
        id,
        institution_id as "institutionId",
        name,
        phone
    `);

    return result.rows[0] ?? null;
  }

  async delete(institutionId: string, guardianId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      delete from guardians
      where id = ${guardianId}
        and institution_id = ${institutionId}
      returning
        id,
        institution_id as "institutionId",
        name,
        phone
    `);

    return result.rows[0] ?? null;
  }

  async findStudentById(institutionId: string, studentId: string) {
    const result = await this.db.execute<StudentRecord>(sql`
      select
        id,
        institution_id as "institutionId",
        first_name as "firstName",
        last_name as "lastName"
      from students
      where id = ${studentId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listStudentGuardians(institutionId: string, studentId: string) {
    const result = await this.db.execute<GuardianRecord>(sql`
      select
        guardians.id,
        guardians.institution_id as "institutionId",
        guardians.name,
        guardians.phone
      from student_guardians
      inner join guardians
        on guardians.id = student_guardians.guardian_id
      inner join students
        on students.id = student_guardians.student_id
      where student_guardians.student_id = ${studentId}
        and guardians.institution_id = ${institutionId}
        and students.institution_id = ${institutionId}
      order by guardians.name asc
    `);

    return result.rows;
  }

  async findStudentGuardianLink(
    institutionId: string,
    studentId: string,
    guardianId: string
  ) {
    const result = await this.db.execute<GuardianRecord>(sql`
      select
        guardians.id,
        guardians.institution_id as "institutionId",
        guardians.name,
        guardians.phone
      from student_guardians
      inner join guardians
        on guardians.id = student_guardians.guardian_id
      inner join students
        on students.id = student_guardians.student_id
      where student_guardians.student_id = ${studentId}
        and student_guardians.guardian_id = ${guardianId}
        and guardians.institution_id = ${institutionId}
        and students.institution_id = ${institutionId}
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

  async removeGuardianFromStudent(
    institutionId: string,
    studentId: string,
    guardianId: string
  ) {
    await this.db.execute(sql`
      delete from student_guardians
      where student_id = ${studentId}
        and guardian_id = ${guardianId}
        and exists (
          select 1
          from students
          where id = ${studentId}
            and institution_id = ${institutionId}
        )
        and exists (
          select 1
          from guardians
          where id = ${guardianId}
            and institution_id = ${institutionId}
        )
    `);
  }

  async countLinkedStudents(institutionId: string, guardianId: string) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from student_guardians
      inner join students
        on students.id = student_guardians.student_id
      where student_guardians.guardian_id = ${guardianId}
        and students.institution_id = ${institutionId}
    `);

    return this.toCount(result.rows[0]?.count);
  }

  private getSortColumn(sortBy: GuardianSortColumn) {
    switch (sortBy) {
      case 'phone':
        return sql.raw('phone');
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
