import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  applyCursorPagination,
  buildFilterConditions,
  buildSortSql,
  type CursorOrderSpec,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type { ListEmailDeliveriesQuery } from '../schemas/email-delivery.schemas.js';

type CountRow = {
  count: string | number;
};

// Stable keyset order for the admin panel (D6): newest first, with the uuid
// `id` closing the order because rows can share a created_at. Matches
// `email_deliveries_institution_created_idx`.
export const EMAIL_DELIVERY_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['created_at', 'id'],
  direction: 'desc',
};

// Whitelisted columns for the uniform filter/sort convention. Constant
// literals — never derived from user input.
export const EMAIL_DELIVERY_LIST_COLUMNS = {
  eventName: 'event_name',
  status: 'status',
  recipientAddress: 'recipient_address',
  createdAt: 'created_at',
} as const;

export type EmailDeliveryRecord = {
  id: string;
  institutionId: string;
  eventId: string;
  eventName: string;
  recipientAddress: string;
  recipientSource: string;
  studentId: string | null;
  status: string;
  attemptCount: number;
  providerMessageId: string | null;
  providerError: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
};

// One eligible address for a student. `address` is trimmed and lowercased
// (RC-R2's dedup key and D2's jobId hash both use this form).
export type RecipientRecord = {
  address: string;
  source: 'guardian' | 'user';
};

export type EmailDeliveryState = {
  emailNotificationsEnabled: boolean;
  senderIdentityConfigured: boolean;
};

// Per-institution sender identity (D4/SI-R1). `senderName` is the configured
// display name; a NULL means the institution is unconfigured and nothing is
// sent (SI-R3).
export type EmailSenderIdentity = {
  senderName: string | null;
  replyToEmail: string | null;
};

// The student behind one triggering event (RC-R1). Grade and attendance events
// carry only the enrollment, so the student is resolved through `enrollments`.
export type EmailStudentTarget = {
  studentId: string;
  studentName: string;
};

export type EmailDeliveryCompletion = {
  status: 'sent' | 'failed' | 'retried';
  providerMessageId?: string | null;
  providerError?: string | null;
};

export type ListEmailDeliveriesInput = ListEmailDeliveriesQuery & {
  institutionId: string;
  filters?: FilterSpec[];
  sort?: SortSpec | null;
};

export class EmailDeliveriesRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // RC-R1: the union of the student's guardians on record with a non-empty
  // email and the users reachable through `guardian_user_links`. Institution
  // scoping is explicit on both branches (RC-R3); one row per address, with the
  // guardian on record winning when an address is both (RC-R2).
  async resolveRecipients(
    institutionId: string,
    studentId: string
  ): Promise<RecipientRecord[]> {
    const result = await this.db.execute<RecipientRecord>(sql`
      select
        candidates.address,
        case
          when bool_or(candidates.source = 'guardian') then 'guardian'
          else 'user'
        end as source
      from (
        select trim(lower(guardians.email)) as address, 'guardian' as source
        from student_guardians
        inner join students
          on students.id = student_guardians.student_id
        inner join guardians
          on guardians.id = student_guardians.guardian_id
        where student_guardians.student_id = ${studentId}
          and students.institution_id = ${institutionId}
          and guardians.institution_id = ${institutionId}
          and guardians.email is not null
          and length(trim(guardians.email)) > 0

        union all

        select trim(lower(users.email)) as address, 'user' as source
        from student_guardians
        inner join students
          on students.id = student_guardians.student_id
        inner join guardian_user_links
          on guardian_user_links.guardian_id = student_guardians.guardian_id
         and guardian_user_links.institution_id = ${institutionId}
        inner join users
          on users.id = guardian_user_links.user_id
        where student_guardians.student_id = ${studentId}
          and students.institution_id = ${institutionId}
          and length(trim(users.email)) > 0
      ) as candidates
      group by candidates.address
      order by candidates.address asc
    `);

    return result.rows;
  }

  // The database half of the once-only guarantee (D2/OC-R1): the unique key
  // makes a redelivered event a no-op instead of a second record, and a
  // conflict is not an error.
  async insertPending(input: {
    institutionId: string;
    eventId: string;
    eventName: string;
    studentId: string | null;
    recipients: RecipientRecord[];
  }): Promise<void> {
    if (input.recipients.length === 0) {
      return;
    }

    const values = input.recipients.map(
      (recipient) => sql`(
        ${input.institutionId},
        ${input.eventId},
        ${input.eventName},
        ${recipient.address},
        ${recipient.source},
        ${input.studentId}
      )`
    );

    await this.db.execute(sql`
      insert into email_deliveries (
        institution_id,
        event_id,
        event_name,
        recipient_address,
        recipient_source,
        student_id
      )
      values ${sql.join(values, sql`, `)}
      on conflict (institution_id, event_id, recipient_address) do nothing
    `);
  }

  // SI-R1/SI-R3: the institution's own sender identity, scoped to the row
  // keyed by `institution_id`. NULL means unconfigured.
  async findSenderIdentity(
    institutionId: string
  ): Promise<EmailSenderIdentity | null> {
    const result = await this.db.execute<EmailSenderIdentity>(sql`
      select
        sender_name as "senderName",
        reply_to_email as "replyToEmail"
      from institutions
      where id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // RC-R1/RC-R3: the student the event is about, resolved from the enrollment
  // every trigger carries, scoped to the institution on both joins.
  async findDeliveryTarget(input: {
    institutionId: string;
    enrollmentId: string;
  }): Promise<EmailStudentTarget | null> {
    const result = await this.db.execute<EmailStudentTarget>(sql`
      select
        students.id as "studentId",
        trim(concat_ws(' ', students.first_name, students.last_name)) as "studentName"
      from enrollments
      inner join students
        on students.id = enrollments.student_id
      where enrollments.id = ${input.enrollmentId}
        and enrollments.institution_id = ${input.institutionId}
        and students.institution_id = ${input.institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  // DR-R1: the outcome transition of one send attempt, addressed by the ledger's
  // unique key so the job payload needs no row id. The claim that admits a send
  // (and increments `attempt_count`) belongs to the idempotency guard, not this
  // transition.
  async completeDelivery(input: {
    institutionId: string;
    eventId: string;
    recipientAddress: string;
    completion: EmailDeliveryCompletion;
  }): Promise<void> {
    const { status, providerMessageId = null, providerError = null } =
      input.completion;

    await this.db.execute(sql`
      update email_deliveries
      set
        status = ${status},
        provider_message_id = ${providerMessageId},
        provider_error = ${providerError},
        sent_at = case when ${status} = 'sent' then now() else sent_at end,
        updated_at = now()
      where institution_id = ${input.institutionId}
        and event_id = ${input.eventId}
        and recipient_address = ${input.recipientAddress}
    `);
  }

  async list(input: ListEmailDeliveriesInput) {
    const filters: SQL[] = [sql`institution_id = ${input.institutionId}`];

    if (input.status) {
      filters.push(sql`status = ${input.status}`);
    }

    if (input.eventName) {
      filters.push(sql`event_name = ${input.eventName}`);
    }

    filters.push(
      ...buildFilterConditions(input.filters ?? [], EMAIL_DELIVERY_LIST_COLUMNS)
    );

    const plan = applyCursorPagination(input, EMAIL_DELIVERY_CURSOR_ORDER);

    if (plan.keyset) {
      filters.push(plan.keyset);
    }

    const whereClause = sql.join(filters, sql` and `);
    const orderBy =
      plan.orderBy ??
      buildSortSql(input.sort ?? null, EMAIL_DELIVERY_LIST_COLUMNS) ??
      sql`created_at desc, id desc`;
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;

    const itemsQuery = sql`
      select
        id,
        institution_id as "institutionId",
        event_id as "eventId",
        event_name as "eventName",
        recipient_address as "recipientAddress",
        recipient_source as "recipientSource",
        student_id as "studentId",
        status,
        attempt_count as "attemptCount",
        provider_message_id as "providerMessageId",
        provider_error as "providerError",
        created_at as "createdAt",
        updated_at as "updatedAt",
        sent_at as "sentAt"
      from email_deliveries
      where ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<EmailDeliveryRecord>(itemsQuery);

      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<EmailDeliveryRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from email_deliveries
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  // PN-R3: the panel's state payload. A missing flag row reads as disabled
  // (D7), and `sender_name IS NULL` is SI-R3's "unconfigured institution".
  async getState(institutionId: string): Promise<EmailDeliveryState | null> {
    const result = await this.db.execute<EmailDeliveryState>(sql`
      select
        coalesce(
          institution_feature_flags.enabled,
          feature_flags.default_value,
          false
        ) as "emailNotificationsEnabled",
        institutions.sender_name is not null as "senderIdentityConfigured"
      from institutions
      left join feature_flags
        on feature_flags.key = 'email_notifications'
      left join institution_feature_flags
        on institution_feature_flags.feature_key = feature_flags.key
       and institution_feature_flags.institution_id = institutions.id
      where institutions.id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
