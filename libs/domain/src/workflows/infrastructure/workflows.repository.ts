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
import type {
  CreateAssignmentBody,
  CreateEventBody,
  CreateMessageBody,
  ListWorkflowQuery,
  UpdateAssignmentBody,
} from '../schemas/workflow.schemas.js';

type CountRow = {
  count: string | number;
};

// The three workflow list endpoints (assignments, messages, school-events)
// share this repository, so their keyset order must be ONE constant. Each query
// aliases its base table (assignments | school_events | messages) to `w` so a
// single qualified column list is valid in all three -- `id` and `created_at`
// are ambiguous unqualified (classrooms.id, message_threads.id/created_at).
// created_at desc mirrors the messages feed and the assignments tiebreak; the
// uuid id closes the order. NOTE: created_at is a timestamp and the shared
// cursor keeps only milliseconds, so a page boundary can drop same-millisecond
// rows (inherited flaw, reported, not fixed here).
export const WORKFLOW_CURSOR_ORDER: CursorOrderSpec = {
  columns: ['w.created_at', 'w.id'],
  direction: 'desc',
};

// Whitelisted filter/sort columns, common to all three base tables (created_at
// is the only meaningful column present on assignments, school_events AND
// messages). Constant literals -- never derived from user input.
export const WORKFLOW_LIST_COLUMNS = {
  createdAt: 'w.created_at',
} as const;

export type WorkflowRole = 'admin' | 'teacher' | 'parent';

export type AssignmentRecord = {
  id: string;
  institutionId: string;
  classroomId: string | null;
  classroomName: string | null;
  subjectId: string | null;
  topicId: string | null;
  // The name of the materia, so the response still reads like an assignment.
  subject: string | null;
  createdByUserId: string | null;
  title: string;
  type: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date | null;
};

export type SchoolEventRecord = {
  id: string;
  institutionId: string;
  classroomId: string | null;
  classroomName: string | null;
  createdByUserId: string | null;
  title: string;
  eventType: string;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date | null;
};

export type MessageRecord = {
  id: string;
  institutionId: string;
  threadId: string;
  subject: string;
  senderUserId: string | null;
  recipientUserId: string | null;
  body: string;
  readAt: Date | null;
  createdAt: Date | null;
};

export type UserRoleRecord = {
  userId: string;
  institutionId: string;
  role: string;
};

export class WorkflowsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async listAssignments(input: ListWorkflowQuery & {
    institutionId: string;
    role: WorkflowRole;
    userId: string;
    filters?: FilterSpec[];
    sort?: SortSpec | null;
  }) {
    const roleFilter = this.assignmentRoleFilter(input);
    const plan = applyCursorPagination(input, WORKFLOW_CURSOR_ORDER);
    const extraFilters = this.andConditions(input, plan.keyset);
    const whereClause = sql`
      w.institution_id = ${input.institutionId}
      ${roleFilter}
      ${extraFilters}
    `;
    const orderBy = plan.orderBy ?? this.assignmentLegacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;
    const itemsQuery = sql`
      select
        w.id,
        w.institution_id as "institutionId",
        w.classroom_id as "classroomId",
        concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName",
        w.created_by_user_id as "createdByUserId",
        w.subject_id as "subjectId",
        w.topic_id as "topicId",
        subjects.name as subject,
        w.title,
        w.type,
        w.status,
        w.due_date as "dueDate",
        w.created_at as "createdAt"
      from assignments w
      left join subjects on subjects.id = w.subject_id
      left join classrooms
        on classrooms.id = w.classroom_id
       and classrooms.institution_id = w.institution_id
      where ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<AssignmentRecord>(itemsQuery);

      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<AssignmentRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from assignments w
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async createAssignment(input: CreateAssignmentBody & {
    institutionId: string;
    userId: string;
  }) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into assignments (
        institution_id,
        classroom_id,
        created_by_user_id,
        subject_id,
        topic_id,
        title,
        type,
        status,
        due_date
      )
      values (
        ${input.institutionId},
        ${input.classroomId ?? null},
        ${input.userId},
        ${input.subjectId ?? null},
        ${input.topicId ?? null},
        ${input.title},
        ${input.type},
        ${input.status},
        ${input.dueDate ?? null}
      )
      returning id
    `);

    return result.rows[0];
  }

  async updateAssignment(input: UpdateAssignmentBody & {
    institutionId: string;
    assignmentId: string;
  }) {
    const assignmentsToSet: SQL[] = [];

    if (input.classroomId !== undefined) {
      assignmentsToSet.push(sql`classroom_id = ${input.classroomId}`);
    }

    if (input.subjectId !== undefined) {
      assignmentsToSet.push(sql`subject_id = ${input.subjectId}`);
    }

    if (input.topicId !== undefined) {
      assignmentsToSet.push(sql`topic_id = ${input.topicId}`);
    }

    if (input.title !== undefined) {
      assignmentsToSet.push(sql`title = ${input.title}`);
    }

    if (input.type !== undefined) {
      assignmentsToSet.push(sql`type = ${input.type}`);
    }

    if (input.status !== undefined) {
      assignmentsToSet.push(sql`status = ${input.status}`);
    }

    if (input.dueDate !== undefined) {
      assignmentsToSet.push(sql`due_date = ${input.dueDate}`);
    }

    const result = await this.db.execute<{ id: string }>(sql`
      update assignments
      set ${sql.join(assignmentsToSet, sql`, `)}
      where id = ${input.assignmentId}
        and institution_id = ${input.institutionId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async findAssignment(institutionId: string, assignmentId: string) {
    const result = await this.db.execute<AssignmentRecord>(sql`
      select
        assignments.id,
        assignments.institution_id as "institutionId",
        assignments.classroom_id as "classroomId",
        concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName",
        assignments.created_by_user_id as "createdByUserId",
        assignments.subject_id as "subjectId",
        assignments.topic_id as "topicId",
        subjects.name as subject,
        assignments.title,
        assignments.type,
        assignments.status,
        assignments.due_date as "dueDate",
        assignments.created_at as "createdAt"
      from assignments
      left join subjects on subjects.id = assignments.subject_id
      left join classrooms
        on classrooms.id = assignments.classroom_id
       and classrooms.institution_id = assignments.institution_id
      where assignments.id = ${assignmentId}
        and assignments.institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listEvents(input: ListWorkflowQuery & {
    institutionId: string;
    role: WorkflowRole;
    userId: string;
    filters?: FilterSpec[];
    sort?: SortSpec | null;
  }) {
    const roleFilter = this.eventRoleFilter(input);
    const plan = applyCursorPagination(input, WORKFLOW_CURSOR_ORDER);
    const extraFilters = this.andConditions(input, plan.keyset);
    const whereClause = sql`
      w.institution_id = ${input.institutionId}
      ${roleFilter}
      ${extraFilters}
    `;
    const orderBy = plan.orderBy ?? this.eventLegacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;
    const itemsQuery = sql`
      select
        w.id,
        w.institution_id as "institutionId",
        w.classroom_id as "classroomId",
        concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName",
        w.created_by_user_id as "createdByUserId",
        w.title,
        w.event_type as "eventType",
        w.starts_at as "startsAt",
        w.ends_at as "endsAt",
        w.created_at as "createdAt"
      from school_events w
      left join classrooms
        on classrooms.id = w.classroom_id
       and classrooms.institution_id = w.institution_id
      where ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<SchoolEventRecord>(itemsQuery);

      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<SchoolEventRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from school_events w
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async createEvent(input: CreateEventBody & {
    institutionId: string;
    userId: string;
  }) {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into school_events (
        institution_id,
        classroom_id,
        created_by_user_id,
        title,
        event_type,
        starts_at,
        ends_at
      )
      values (
        ${input.institutionId},
        ${input.classroomId ?? null},
        ${input.userId},
        ${input.title},
        ${input.eventType},
        ${input.startsAt},
        ${input.endsAt ?? null}
      )
      returning id
    `);

    return result.rows[0];
  }

  async findEvent(institutionId: string, eventId: string) {
    const result = await this.db.execute<SchoolEventRecord>(sql`
      select
        school_events.id,
        school_events.institution_id as "institutionId",
        school_events.classroom_id as "classroomId",
        concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName",
        school_events.created_by_user_id as "createdByUserId",
        school_events.title,
        school_events.event_type as "eventType",
        school_events.starts_at as "startsAt",
        school_events.ends_at as "endsAt",
        school_events.created_at as "createdAt"
      from school_events
      left join classrooms
        on classrooms.id = school_events.classroom_id
       and classrooms.institution_id = school_events.institution_id
      where school_events.id = ${eventId}
        and school_events.institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async listMessages(input: ListWorkflowQuery & {
    institutionId: string;
    userId: string;
    filters?: FilterSpec[];
    sort?: SortSpec | null;
  }) {
    const plan = applyCursorPagination(input, WORKFLOW_CURSOR_ORDER);
    const extraFilters = this.andConditions(input, plan.keyset);
    const whereClause = sql`
      w.institution_id = ${input.institutionId}
      and (
        w.sender_user_id = ${input.userId}
        or w.recipient_user_id = ${input.userId}
      )
      ${extraFilters}
    `;
    const orderBy = plan.orderBy ?? this.messageLegacyOrderBy(input);
    const offsetClause =
      plan.offset === null ? sql`` : sql`offset ${plan.offset}`;
    const itemsQuery = sql`
      select
        w.id,
        w.institution_id as "institutionId",
        w.thread_id as "threadId",
        message_threads.subject,
        w.sender_user_id as "senderUserId",
        w.recipient_user_id as "recipientUserId",
        w.body,
        w.read_at as "readAt",
        w.created_at as "createdAt"
      from messages w
      inner join message_threads
        on message_threads.id = w.thread_id
       and message_threads.institution_id = w.institution_id
      where ${whereClause}
      order by ${orderBy}
      limit ${plan.fetchLimit}
      ${offsetClause}
    `;

    if (plan.offset === null) {
      const items = await this.db.execute<MessageRecord>(itemsQuery);

      return { items: items.rows };
    }

    const [items, totalRows] = await Promise.all([
      this.db.execute<MessageRecord>(itemsQuery),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from messages w
        where ${whereClause}
      `),
    ]);

    return {
      items: items.rows,
      total: this.toCount(totalRows.rows[0]?.count),
    };
  }

  async createThreadWithMessage(input: CreateMessageBody & {
    institutionId: string;
    userId: string;
  }) {
    const thread = await this.db.execute<{ id: string }>(sql`
      insert into message_threads (
        institution_id,
        subject,
        created_by_user_id
      )
      values (
        ${input.institutionId},
        ${input.subject},
        ${input.userId}
      )
      returning id
    `);
    const threadId = thread.rows[0]?.id;

    if (!threadId) {
      return null;
    }

    const message = await this.db.execute<{ id: string }>(sql`
      insert into messages (
        institution_id,
        thread_id,
        sender_user_id,
        recipient_user_id,
        body
      )
      values (
        ${input.institutionId},
        ${threadId},
        ${input.userId},
        ${input.recipientUserId},
        ${input.body}
      )
      returning id
    `);

    return message.rows[0] ?? null;
  }

  async findMessage(institutionId: string, messageId: string) {
    const result = await this.db.execute<MessageRecord>(sql`
      select
        messages.id,
        messages.institution_id as "institutionId",
        messages.thread_id as "threadId",
        message_threads.subject,
        messages.sender_user_id as "senderUserId",
        messages.recipient_user_id as "recipientUserId",
        messages.body,
        messages.read_at as "readAt",
        messages.created_at as "createdAt"
      from messages
      inner join message_threads
        on message_threads.id = messages.thread_id
       and message_threads.institution_id = messages.institution_id
      where messages.id = ${messageId}
        and messages.institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async markMessageRead(input: {
    institutionId: string;
    messageId: string;
    userId: string;
  }) {
    const result = await this.db.execute<{ id: string }>(sql`
      update messages
      set read_at = coalesce(read_at, now())
      where id = ${input.messageId}
        and institution_id = ${input.institutionId}
        and recipient_user_id = ${input.userId}
      returning id
    `);

    return result.rows[0] ?? null;
  }

  async findClassroom(institutionId: string, classroomId: string) {
    const result = await this.db.execute<{ id: string }>(sql`
      select id
      from classrooms
      where id = ${classroomId}
        and institution_id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async isTeacherAssignedToClassroom(input: {
    institutionId: string;
    teacherUserId: string;
    classroomId: string;
  }) {
    const result = await this.db.execute<CountRow>(sql`
      select count(*)::int as count
      from teacher_classroom_assignments
      where institution_id = ${input.institutionId}
        and teacher_user_id = ${input.teacherUserId}
        and classroom_id = ${input.classroomId}
    `);

    return this.toCount(result.rows[0]?.count) > 0;
  }

  async findUserRole(institutionId: string, userId: string) {
    const result = await this.db.execute<UserRoleRecord>(sql`
      select
        user_id as "userId",
        institution_id as "institutionId",
        role
      from user_institution_roles
      where institution_id = ${institutionId}
        and user_id = ${userId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async createNotification(input: {
    institutionId: string;
    eventName: string;
    title: string;
    message: string;
    metadata: unknown;
  }) {
    await this.db.execute(sql`
      insert into notifications (
        institution_id,
        event_name,
        title,
        message,
        metadata
      )
      values (
        ${input.institutionId},
        ${input.eventName},
        ${input.title},
        ${input.message},
        ${JSON.stringify(input.metadata)}::jsonb
      )
    `);
  }

  private assignmentRoleFilter(input: {
    role: WorkflowRole;
    userId: string;
  }) {
    if (input.role === 'teacher') {
      return sql`
        and w.classroom_id is not null
        and exists (
          select 1
          from teacher_classroom_assignments tca
          where tca.classroom_id = w.classroom_id
            and tca.institution_id = w.institution_id
            and tca.teacher_user_id = ${input.userId}
        )
      `;
    }

    if (input.role === 'parent') {
      return sql`
        and exists (
          select 1
          from guardian_user_links gul
          inner join student_guardians sg
            on sg.guardian_id = gul.guardian_id
          inner join enrollments e
            on e.student_id = sg.student_id
           and e.institution_id = gul.institution_id
           and e.classroom_id = w.classroom_id
           and e.status = 'active'
          where gul.institution_id = w.institution_id
            and gul.user_id = ${input.userId}
        )
      `;
    }

    return sql``;
  }

  private eventRoleFilter(input: {
    role: WorkflowRole;
    userId: string;
  }) {
    if (input.role === 'teacher') {
      return sql`
        and (
          w.classroom_id is null
          or exists (
            select 1
            from teacher_classroom_assignments tca
            where tca.classroom_id = w.classroom_id
              and tca.institution_id = w.institution_id
              and tca.teacher_user_id = ${input.userId}
          )
        )
      `;
    }

    if (input.role === 'parent') {
      return sql`
        and (
          w.classroom_id is null
          or exists (
            select 1
            from guardian_user_links gul
            inner join student_guardians sg
              on sg.guardian_id = gul.guardian_id
            inner join enrollments e
              on e.student_id = sg.student_id
             and e.institution_id = gul.institution_id
             and e.classroom_id = w.classroom_id
             and e.status = 'active'
            where gul.institution_id = w.institution_id
              and gul.user_id = ${input.userId}
          )
        )
      `;
    }

    return sql``;
  }

  // Uniform filter conditions plus the cursor keyset, appended to the base
  // WHERE fragment with a leading `and` (empty in cursor-less, filter-less mode).
  private andConditions(
    input: { filters?: FilterSpec[]; sort?: SortSpec | null },
    keyset: SQL | null
  ): SQL {
    const conditions = buildFilterConditions(
      input.filters ?? [],
      WORKFLOW_LIST_COLUMNS
    );

    if (keyset) {
      conditions.push(keyset);
    }

    if (conditions.length === 0) {
      return sql``;
    }

    return sql`and ${sql.join(conditions, sql` and `)}`;
  }

  // The standard `sort` param wins over the legacy order; cursor mode never
  // reaches here (the stable keyset order wins).
  private assignmentLegacyOrderBy(input: {
    sort?: SortSpec | null;
  }): SQL {
    return (
      buildSortSql(input.sort ?? null, WORKFLOW_LIST_COLUMNS) ??
      sql`w.due_date asc nulls last, w.created_at desc`
    );
  }

  private eventLegacyOrderBy(input: { sort?: SortSpec | null }): SQL {
    return (
      buildSortSql(input.sort ?? null, WORKFLOW_LIST_COLUMNS) ??
      sql`w.starts_at asc`
    );
  }

  private messageLegacyOrderBy(input: { sort?: SortSpec | null }): SQL {
    return (
      buildSortSql(input.sort ?? null, WORKFLOW_LIST_COLUMNS) ??
      sql`w.created_at desc`
    );
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
