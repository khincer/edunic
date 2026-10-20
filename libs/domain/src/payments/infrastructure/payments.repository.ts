import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type PaymentRecord = {
  id: string;
  studentId: string;
  concept: string;
  amountCents: number;
  dueDate: Date | null;
  paidAt: Date | null;
  method: string;
  status: string;
  receiptNumber: string;
  recordedByUserId: string;
  note: string | null;
  createdAt: Date | null;
};

export type PaymentReceiptRow = {
  id: string;
  studentId: string;
  concept: string;
  amountCents: number;
  dueDate: Date | null;
  paidAt: Date | null;
  method: string;
  status: string;
  receiptNumber: string;
  note: string | null;
  createdAt: Date | null;
  studentName: string;
  schoolName: string;
  schoolSenderName: string | null;
  schoolReplyToEmail: string | null;
};

export type StudentBalanceRow = {
  studentId: string;
  studentName: string;
  billedCents: number;
  paidCents: number;
  overdueCount: number;
};

export type ListPaymentsInput = {
  studentIds?: string[];
  studentId?: string;
  status?: string;
  limit: number;
  offset: number;
};

export class PaymentsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list(input: ListPaymentsInput) {
    const filters: SQL[] = [];

    if (input.studentIds) {
      if (input.studentIds.length === 0) {
        return { items: [] as PaymentRecord[], total: 0 };
      }

      filters.push(sql`p.student_id in (${sql.join(
        input.studentIds.map((id) => sql`${id}`),
        sql`, `
      )})`);
    }

    if (input.studentId) {
      filters.push(sql`p.student_id = ${input.studentId}`);
    }

    if (input.status) {
      filters.push(sql`p.status = ${input.status}`);
    }

    const whereClause =
      filters.length > 0 ? sql`where ${sql.join(filters, sql` and `)}` : sql``;

    const [items, totalRows] = await Promise.all([
      this.db.execute<PaymentRecord>(sql`
        select
          p.id,
          p.student_id as "studentId",
          p.concept,
          p.amount_cents as "amountCents",
          p.due_date as "dueDate",
          p.paid_at as "paidAt",
          p.method,
          p.status,
          p.receipt_number as "receiptNumber",
          p.recorded_by_user_id as "recordedByUserId",
          p.note,
          p.created_at as "createdAt"
        from payments p
        ${whereClause}
        order by p.created_at desc, p.id desc
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<{ count: string }>(sql`
        select count(*)::int as count
        from payments p
        ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: Number(totalRows.rows[0]?.count ?? 0),
    };
  }

  async findById(paymentId: string) {
    const result = await this.db.execute<PaymentRecord>(sql`
      select
        p.id,
        p.student_id as "studentId",
        p.concept,
        p.amount_cents as "amountCents",
        p.due_date as "dueDate",
        p.paid_at as "paidAt",
        p.method,
        p.status,
        p.receipt_number as "receiptNumber",
        p.recorded_by_user_id as "recordedByUserId",
        p.note,
        p.created_at as "createdAt"
      from payments p
      where p.id = ${paymentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async studentExists(studentId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      select id from students where id = ${studentId} limit 1
    `);

    return result.rows[0] ?? null;
  }

  async create(input: {
    studentId: string;
    concept: string;
    amountCents: number;
    dueDate: string | null;
    method: string;
    status: string;
    paidAt: string | null;
    recordedByUserId: string;
    note: string | null;
  }) {
    // The receipt number comes from a sequence, so two payments registered at
    // the same moment never share one.
    const result = await this.db.execute<PaymentRecord>(sql`
      with receipt as (
        select 'R-' || lpad(nextval('payment_receipt_number_seq')::text, 6, '0') as number
      )
      insert into payments (
        id,
        student_id,
        concept,
        amount_cents,
        due_date,
        paid_at,
        method,
        status,
        receipt_number,
        recorded_by_user_id,
        note
      )
      select
        gen_random_uuid(),
        ${input.studentId},
        ${input.concept},
        ${input.amountCents},
        ${input.dueDate},
        ${input.paidAt},
        ${input.method},
        ${input.status},
        receipt.number,
        ${input.recordedByUserId},
        ${input.note}
      from receipt
      returning
        id,
        student_id as "studentId",
        concept,
        amount_cents as "amountCents",
        due_date as "dueDate",
        paid_at as "paidAt",
        method,
        status,
        receipt_number as "receiptNumber",
        recorded_by_user_id as "recordedByUserId",
        note,
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  async update(
    paymentId: string,
    input: {
      concept?: string;
      amountCents?: number;
      dueDate?: string | null;
      method?: string;
      status?: string;
      paidAt?: string | null;
      note?: string | null;
    }
  ) {
    const assignments: SQL[] = [];

    if (input.concept !== undefined) {
      assignments.push(sql`concept = ${input.concept}`);
    }

    if (input.amountCents !== undefined) {
      assignments.push(sql`amount_cents = ${input.amountCents}`);
    }

    if (input.dueDate !== undefined) {
      assignments.push(sql`due_date = ${input.dueDate}`);
    }

    if (input.method !== undefined) {
      assignments.push(sql`method = ${input.method}`);
    }

    if (input.status !== undefined) {
      assignments.push(sql`status = ${input.status}`);
    }

    if (input.paidAt !== undefined) {
      assignments.push(sql`paid_at = ${input.paidAt}`);
    }

    if (input.note !== undefined) {
      assignments.push(sql`note = ${input.note}`);
    }

    if (assignments.length === 0) {
      return this.findById(paymentId);
    }

    const result = await this.db.execute<PaymentRecord>(sql`
      update payments
      set ${sql.join(assignments, sql`, `)}
      where id = ${paymentId}
      returning
        id,
        student_id as "studentId",
        concept,
        amount_cents as "amountCents",
        due_date as "dueDate",
        paid_at as "paidAt",
        method,
        status,
        receipt_number as "receiptNumber",
        recorded_by_user_id as "recordedByUserId",
        note,
        created_at as "createdAt"
    `);

    return result.rows[0] ?? null;
  }

  // Everything a receipt needs: the payment, the student it belongs to and
  // the school that issued it.
  async findReceiptContext(paymentId: string) {
    const result = await this.db.execute<PaymentReceiptRow>(sql`
      select
        p.id,
        p.student_id as "studentId",
        p.concept,
        p.amount_cents as "amountCents",
        p.due_date as "dueDate",
        p.paid_at as "paidAt",
        p.method,
        p.status,
        p.receipt_number as "receiptNumber",
        p.note,
        p.created_at as "createdAt",
        concat(s.first_name, ' ', s.last_name) as "studentName",
        school.name as "schoolName",
        school.sender_name as "schoolSenderName",
        school.reply_to_email as "schoolReplyToEmail"
      from payments p
      inner join students s on s.id = p.student_id
      cross join lateral (
        select name, sender_name, reply_to_email
        from institutions
        order by created_at asc, id asc
        limit 1
      ) school
      where p.id = ${paymentId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // What every student owes and what is late.
  async listStudentBalances(now: Date) {
    const result = await this.db.execute<StudentBalanceRow>(sql`
      select
        s.id as "studentId",
        concat(s.first_name, ' ', s.last_name) as "studentName",
        coalesce(sum(p.amount_cents) filter (where p.status <> 'cancelled'), 0)::int as "billedCents",
        coalesce(sum(p.amount_cents) filter (where p.status = 'paid'), 0)::int as "paidCents",
        count(*) filter (
          where p.status = 'pending'
            and p.due_date is not null
            and p.due_date < ${now}
        )::int as "overdueCount"
      from students s
      left join payments p on p.student_id = s.id
      group by s.id, s.first_name, s.last_name
      order by s.first_name asc, s.last_name asc
    `);

    return result.rows;
  }
}
