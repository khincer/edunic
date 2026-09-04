import {
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
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

export type WorkflowRole = 'admin' | 'teacher' | 'parent';

export type AssignmentRecord = {
  id: string;
  institutionId: string;
  classroomId: string | null;
  classroomName: string | null;
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
  }) {
    const roleFilter = this.assignmentRoleFilter(input);
    const whereClause = sql`
      assignments.institution_id = ${input.institutionId}
      ${roleFilter}
    `;

    const [items, totalRows] = await Promise.all([
      this.db.execute<AssignmentRecord>(sql`
        select
          assignments.id,
          assignments.institution_id as "institutionId",
          assignments.classroom_id as "classroomId",
          concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName",
          assignments.created_by_user_id as "createdByUserId",
          assignments.title,
          assignments.type,
          assignments.status,
          assignments.due_date as "dueDate",
          assignments.created_at as "createdAt"
        from assignments
        left join classrooms
          on classrooms.id = assignments.classroom_id
         and classrooms.institution_id = assignments.institution_id
        where ${whereClause}
        order by assignments.due_date asc nulls last, assignments.created_at desc
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from assignments
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
        title,
        type,
        status,
        due_date
      )
      values (
        ${input.institutionId},
        ${input.classroomId ?? null},
        ${input.userId},
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
        assignments.title,
        assignments.type,
        assignments.status,
        assignments.due_date as "dueDate",
        assignments.created_at as "createdAt"
      from assignments
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
  }) {
    const roleFilter = this.eventRoleFilter(input);
    const whereClause = sql`
      school_events.institution_id = ${input.institutionId}
      ${roleFilter}
    `;

    const [items, totalRows] = await Promise.all([
      this.db.execute<SchoolEventRecord>(sql`
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
        where ${whereClause}
        order by school_events.starts_at asc
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from school_events
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
  }) {
    const whereClause = sql`
      messages.institution_id = ${input.institutionId}
      and (
        messages.sender_user_id = ${input.userId}
        or messages.recipient_user_id = ${input.userId}
      )
    `;

    const [items, totalRows] = await Promise.all([
      this.db.execute<MessageRecord>(sql`
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
        where ${whereClause}
        order by messages.created_at desc
        limit ${input.limit}
        offset ${input.offset}
      `),
      this.db.execute<CountRow>(sql`
        select count(*)::int as count
        from messages
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
        and assignments.classroom_id is not null
        and exists (
          select 1
          from teacher_classroom_assignments tca
          where tca.classroom_id = assignments.classroom_id
            and tca.institution_id = assignments.institution_id
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
           and e.classroom_id = assignments.classroom_id
           and e.status = 'active'
          where gul.institution_id = assignments.institution_id
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
          school_events.classroom_id is null
          or exists (
            select 1
            from teacher_classroom_assignments tca
            where tca.classroom_id = school_events.classroom_id
              and tca.institution_id = school_events.institution_id
              and tca.teacher_user_id = ${input.userId}
          )
        )
      `;
    }

    if (input.role === 'parent') {
      return sql`
        and (
          school_events.classroom_id is null
          or exists (
            select 1
            from guardian_user_links gul
            inner join student_guardians sg
              on sg.guardian_id = gul.guardian_id
            inner join enrollments e
              on e.student_id = sg.student_id
             and e.institution_id = gul.institution_id
             and e.classroom_id = school_events.classroom_id
             and e.status = 'active'
            where gul.institution_id = school_events.institution_id
              and gul.user_id = ${input.userId}
          )
        )
      `;
    }

    return sql``;
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
