import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

type Database = FastifyInstance['db'];

type CountRow = {
  count: string | number;
};

export type InstitutionContextRow = {
  id: string;
  name: string;
};

export type ActivePeriodRow = {
  id: string;
  year: number;
  term: number;
  startDate: Date | null;
  endDate: Date | null;
};

export type AttendanceSummaryRow = {
  present: string | number;
  late: string | number;
  absent: string | number;
  marked: string | number;
};

export type GradeSubmissionSummaryRow = {
  submitted: string | number;
  total: string | number;
};

export type FeatureStatusRow = {
  key: string;
  enabled: boolean;
  source: 'default' | 'institution';
};

export type ExtensionStatusRow = {
  key: string;
  name: string | null;
  enabled: boolean;
};

export type NotificationRow = {
  id: string;
  eventName: string;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date | null;
};

export type AssignmentRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  dueDate: Date | null;
  classroomName: string | null;
};

export type SchoolEventRow = {
  id: string;
  title: string;
  eventType: string;
  startsAt: Date;
  endsAt: Date | null;
  classroomName: string | null;
};

export type MessageRow = {
  id: string;
  subject: string;
  body: string;
  readAt: Date | null;
  createdAt: Date | null;
};

export type ReportHistoryRow = {
  id: string;
  studentId: string;
  studentName: string;
  year: number;
  reportType: string;
  createdAt: Date | null;
};

export type AuditActivityRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: Date | null;
};

export type ClassroomSnapshotRow = {
  id: string;
  name: string;
  gradeLevel: number;
  section: string | null;
  rosterCount: string | number;
  attendanceMarkedToday: string | number;
};

export type RecentGradeRow = {
  id: string;
  subject: string;
  score: number;
  createdAt: Date | null;
  studentId: string;
  studentName: string;
};

export type StudentRiskRow = {
  studentId: string;
  studentName: string;
  classroomName: string | null;
  average: string | number | null;
  absences: string | number;
};

export type ParentStudentRow = {
  studentId: string;
  fullName: string;
  dateOfBirth: string | null;
  guardianName: string;
  enrollmentId: string | null;
  classroomName: string | null;
  enrollmentStatus: string | null;
  academicYear: number | null;
  academicTerm: number | null;
};

export type StudentAverageRow = {
  average: string | number | null;
  gradeCount: string | number;
};

export class DashboardsRepository {
  constructor(private readonly db: Database) {}

  async getInstitutionContext(institutionId: string) {
    const result = await this.db.execute<InstitutionContextRow>(sql`
      select id, name
      from institutions
      where id = ${institutionId}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async countStudents(institutionId: string) {
    return this.count(sql`
      select count(*)::int as count
      from students
      where institution_id = ${institutionId}
    `);
  }

  async countGuardians(institutionId: string) {
    return this.count(sql`
      select count(*)::int as count
      from guardians
      where institution_id = ${institutionId}
    `);
  }

  async countUsersByRole(institutionId: string, role: string) {
    return this.count(sql`
      select count(*)::int as count
      from user_institution_roles
      where institution_id = ${institutionId}
        and role = ${role}
    `);
  }

  async countActiveEnrollments(institutionId: string, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = enrollments.classroom_id
         and tca.institution_id = enrollments.institution_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    return this.count(sql`
      select count(*)::int as count
      from enrollments
      ${assignmentJoin}
      where enrollments.institution_id = ${institutionId}
        and enrollments.status = 'active'
    `);
  }

  async countClassrooms(institutionId: string) {
    return this.count(sql`
      select count(*)::int as count
      from classrooms
      where institution_id = ${institutionId}
    `);
  }

  async getActiveAcademicPeriod(institutionId: string) {
    const result = await this.db.execute<ActivePeriodRow>(sql`
      select
        id,
        year,
        term,
        start_date as "startDate",
        end_date as "endDate"
      from academic_periods
      where institution_id = ${institutionId}
      order by
        case
          when coalesce(start_date::date, current_date) <= current_date
           and coalesce(end_date::date, current_date) >= current_date
          then 0
          else 1
        end,
        year desc,
        term desc
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async getTodayAttendanceSummary(institutionId: string, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join enrollments e
          on e.id = attendance.enrollment_id
         and e.institution_id = attendance.institution_id
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.institution_id = e.institution_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<AttendanceSummaryRow>(sql`
      select
        count(*) filter (where status = 'present')::int as present,
        count(*) filter (where status = 'late')::int as late,
        count(*) filter (where status = 'absent')::int as absent,
        count(*)::int as marked
      from attendance
      ${assignmentJoin}
      where attendance.institution_id = ${institutionId}
        and attendance.date::date = current_date
    `);

    return this.toAttendanceSummary(result.rows[0]);
  }

  async getGradeSubmissionSummary(
    institutionId: string,
    academicPeriodId: string | null,
    teacherUserId?: string
  ) {
    if (!academicPeriodId) {
      return { submitted: 0, total: 0 };
    }

    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.institution_id = e.institution_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<GradeSubmissionSummaryRow>(sql`
      select
        count(distinct g.enrollment_id)::int as submitted,
        count(distinct e.id)::int as total
      from enrollments e
      ${assignmentJoin}
      left join grades g
        on g.enrollment_id = e.id
       and g.institution_id = e.institution_id
      where e.institution_id = ${institutionId}
        and e.academic_period_id = ${academicPeriodId}
        and e.status = 'active'
    `);

    const row = result.rows[0];

    return {
      submitted: this.toCount(row?.submitted),
      total: this.toCount(row?.total),
    };
  }

  async listFeatureStatuses(institutionId: string) {
    const result = await this.db.execute<FeatureStatusRow>(sql`
      select
        feature_flags.key,
        coalesce(institution_feature_flags.enabled, feature_flags.default_value) as enabled,
        case
          when institution_feature_flags.enabled is null then 'default'
          else 'institution'
        end as source
      from feature_flags
      left join institution_feature_flags
        on institution_feature_flags.feature_key = feature_flags.key
       and institution_feature_flags.institution_id = ${institutionId}
      order by feature_flags.key asc
    `);

    return result.rows.filter((flag) => flag.key !== 'billing_module');
  }

  async listExtensionStatuses(institutionId: string) {
    const result = await this.db.execute<ExtensionStatusRow>(sql`
      select
        extensions.key,
        extensions.name,
        (
          extensions.enabled = true
          and institution_extensions.institution_id is not null
        ) as enabled
      from extensions
      left join institution_extensions
        on institution_extensions.extension_key = extensions.key
       and institution_extensions.institution_id = ${institutionId}
      order by extensions.key asc
    `);

    return result.rows;
  }

  async listRecentNotifications(input: {
    institutionId: string;
    role: string;
    userId?: string;
    limit?: number;
  }) {
    const roleFilter = sql`(
      metadata is null
      or metadata->'audience' is null
      or metadata->'audience' ? ${input.role}
    )`;
    const parentFilter =
      input.role === 'parent' && input.userId
        ? sql`
          and (
            metadata->'studentIds' is null
            or exists (
              select 1
              from guardian_user_links gul
              inner join student_guardians sg
                on sg.guardian_id = gul.guardian_id
              where gul.institution_id = notifications.institution_id
                and gul.user_id = ${input.userId}
                and metadata->'studentIds' ? sg.student_id::text
            )
          )
        `
        : sql``;
    const teacherFilter =
      input.role === 'teacher' && input.userId
        ? sql`
          and (
            metadata->'classroomIds' is null
            or exists (
              select 1
              from teacher_classroom_assignments tca
              where tca.institution_id = notifications.institution_id
                and tca.teacher_user_id = ${input.userId}
                and metadata->'classroomIds' ? tca.classroom_id::text
            )
          )
        `
        : sql``;

    const result = await this.db.execute<NotificationRow>(sql`
      select
        id,
        event_name as "eventName",
        title,
        message,
        read_at as "readAt",
        created_at as "createdAt"
      from notifications
      where institution_id = ${input.institutionId}
        and ${roleFilter}
        ${parentFilter}
        ${teacherFilter}
      order by created_at desc
      limit ${input.limit ?? 5}
    `);

    return result.rows;
  }

  async listRecentAuditActivity(institutionId: string, limit = 5) {
    const result = await this.db.execute<AuditActivityRow>(sql`
      select
        id,
        action,
        entity,
        entity_id as "entityId",
        created_at as "createdAt"
      from audit_logs
      where institution_id = ${institutionId}
      order by created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listClassroomSnapshots(institutionId: string, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = c.id
         and tca.institution_id = c.institution_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<ClassroomSnapshotRow>(sql`
      select
        c.id,
        concat('Grade ', c.grade_level, coalesce(' ' || c.section, '')) as name,
        c.grade_level as "gradeLevel",
        c.section,
        count(distinct e.id)::int as "rosterCount",
        count(distinct a.id)::int as "attendanceMarkedToday"
      from classrooms c
      ${assignmentJoin}
      left join enrollments e
        on e.classroom_id = c.id
       and e.institution_id = c.institution_id
       and e.status = 'active'
      left join attendance a
        on a.enrollment_id = e.id
       and a.institution_id = e.institution_id
       and a.date::date = current_date
      where c.institution_id = ${institutionId}
      group by c.id, c.grade_level, c.section
      order by c.grade_level asc, c.section asc
    `);

    return result.rows;
  }

  async listRecentGrades(institutionId: string, limit = 5, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.institution_id = e.institution_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<RecentGradeRow>(sql`
      select
        g.id,
        g.subject,
        g.score,
        g.created_at as "createdAt",
        s.id as "studentId",
        concat(s.first_name, ' ', s.last_name) as "studentName"
      from grades g
      inner join enrollments e
        on e.id = g.enrollment_id
       and e.institution_id = g.institution_id
      ${assignmentJoin}
      inner join students s
        on s.id = e.student_id
       and s.institution_id = e.institution_id
      where g.institution_id = ${institutionId}
      order by g.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listStudentsAtRisk(institutionId: string, limit = 5, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.institution_id = e.institution_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<StudentRiskRow>(sql`
      select
        s.id as "studentId",
        concat(s.first_name, ' ', s.last_name) as "studentName",
        concat('Grade ', c.grade_level, coalesce(' ' || c.section, '')) as "classroomName",
        avg(g.score)::numeric(10,2) as average,
        count(a.id) filter (where a.status = 'absent')::int as absences
      from students s
      inner join enrollments e
        on e.student_id = s.id
       and e.institution_id = s.institution_id
       and e.status = 'active'
      ${assignmentJoin}
      left join classrooms c
        on c.id = e.classroom_id
       and c.institution_id = e.institution_id
      left join grades g
        on g.enrollment_id = e.id
       and g.institution_id = e.institution_id
      left join attendance a
        on a.enrollment_id = e.id
       and a.institution_id = e.institution_id
      where s.institution_id = ${institutionId}
      group by s.id, s.first_name, s.last_name, c.grade_level, c.section
      having avg(g.score) < 80
          or count(a.id) filter (where a.status = 'absent') > 0
      order by
        count(a.id) filter (where a.status = 'absent') desc,
        avg(g.score) asc nulls last
      limit ${limit}
    `);

    return result.rows;
  }

  async listParentStudents(institutionId: string, userId: string) {
    const result = await this.db.execute<ParentStudentRow>(sql`
      select distinct on (s.id)
        s.id as "studentId",
        concat(s.first_name, ' ', s.last_name) as "fullName",
        s.date_of_birth as "dateOfBirth",
        g.name as "guardianName",
        latest_enrollment.id as "enrollmentId",
        latest_enrollment."classroomName",
        latest_enrollment.status as "enrollmentStatus",
        latest_enrollment.year as "academicYear",
        latest_enrollment.term as "academicTerm"
      from student_guardians sg
      inner join guardian_user_links gul
        on gul.guardian_id = sg.guardian_id
       and gul.institution_id = ${institutionId}
       and gul.user_id = ${userId}
      inner join guardians g
        on g.id = sg.guardian_id
       and g.institution_id = gul.institution_id
      inner join students s
        on s.id = sg.student_id
       and s.institution_id = g.institution_id
      left join lateral (
        select
          e.id,
          e.status,
          ap.year,
          ap.term,
          concat('Grade ', c.grade_level, coalesce(' ' || c.section, '')) as "classroomName"
        from enrollments e
        inner join academic_periods ap
          on ap.id = e.academic_period_id
         and ap.institution_id = e.institution_id
        left join classrooms c
          on c.id = e.classroom_id
         and c.institution_id = e.institution_id
        where e.student_id = s.id
          and e.institution_id = s.institution_id
        order by
          case when e.status = 'active' then 0 else 1 end,
          ap.year desc,
          ap.term desc
        limit 1
      ) latest_enrollment on true
      where g.institution_id = ${institutionId}
      order by s.id, g.name asc
    `);

    return result.rows;
  }

  async getStudentAverage(institutionId: string, studentId: string, year: number) {
    const result = await this.db.execute<StudentAverageRow>(sql`
      select
        avg(g.score)::numeric(10,2) as average,
        count(g.id)::int as "gradeCount"
      from grades g
      inner join enrollments e
        on e.id = g.enrollment_id
       and e.institution_id = g.institution_id
      inner join academic_periods ap
        on ap.id = e.academic_period_id
       and ap.institution_id = e.institution_id
      where g.institution_id = ${institutionId}
        and e.student_id = ${studentId}
        and ap.year = ${year}
    `);

    const row = result.rows[0];

    return {
      average: row?.average === null || row?.average === undefined ? null : Number(row.average),
      gradeCount: this.toCount(row?.gradeCount),
    };
  }

  async getStudentAttendanceSummary(institutionId: string, studentId: string) {
    const result = await this.db.execute<AttendanceSummaryRow>(sql`
      select
        count(*) filter (where a.status = 'present')::int as present,
        count(*) filter (where a.status = 'late')::int as late,
        count(*) filter (where a.status = 'absent')::int as absent,
        count(*)::int as marked
      from attendance a
      inner join enrollments e
        on e.id = a.enrollment_id
       and e.institution_id = a.institution_id
      where a.institution_id = ${institutionId}
        and e.student_id = ${studentId}
    `);

    return this.toAttendanceSummary(result.rows[0]);
  }

  async listStudentRecentGrades(
    institutionId: string,
    studentId: string,
    limit = 3
  ) {
    const result = await this.db.execute<RecentGradeRow>(sql`
      select
        g.id,
        g.subject,
        g.score,
        g.created_at as "createdAt",
        s.id as "studentId",
        concat(s.first_name, ' ', s.last_name) as "studentName"
      from grades g
      inner join enrollments e
        on e.id = g.enrollment_id
       and e.institution_id = g.institution_id
      inner join students s
        on s.id = e.student_id
       and s.institution_id = e.institution_id
      where g.institution_id = ${institutionId}
        and s.id = ${studentId}
      order by g.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listUpcomingAssignments(input: {
    institutionId: string;
    role: string;
    userId?: string;
    limit?: number;
  }) {
    const teacherJoin =
      input.role === 'teacher' && input.userId
        ? sql`
          inner join teacher_classroom_assignments tca
            on tca.classroom_id = assignments.classroom_id
           and tca.institution_id = assignments.institution_id
           and tca.teacher_user_id = ${input.userId}
        `
        : sql``;
    const parentWhere =
      input.role === 'parent' && input.userId
        ? sql`
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
        `
        : sql``;

    const result = await this.db.execute<AssignmentRow>(sql`
      select
        assignments.id,
        assignments.title,
        assignments.type,
        assignments.status,
        assignments.due_date as "dueDate",
        concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName"
      from assignments
      ${teacherJoin}
      left join classrooms
        on classrooms.id = assignments.classroom_id
       and classrooms.institution_id = assignments.institution_id
      where assignments.institution_id = ${input.institutionId}
        and assignments.status = 'published'
        ${parentWhere}
      order by assignments.due_date asc nulls last, assignments.created_at desc
      limit ${input.limit ?? 5}
    `);

    return result.rows;
  }

  async listUpcomingEvents(input: {
    institutionId: string;
    role: string;
    userId?: string;
    limit?: number;
  }) {
    const teacherWhere =
      input.role === 'teacher' && input.userId
        ? sql`
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
        `
        : sql``;
    const parentWhere =
      input.role === 'parent' && input.userId
        ? sql`
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
        `
        : sql``;

    const result = await this.db.execute<SchoolEventRow>(sql`
      select
        school_events.id,
        school_events.title,
        school_events.event_type as "eventType",
        school_events.starts_at as "startsAt",
        school_events.ends_at as "endsAt",
        concat('Grade ', classrooms.grade_level, coalesce(' ' || classrooms.section, '')) as "classroomName"
      from school_events
      left join classrooms
        on classrooms.id = school_events.classroom_id
       and classrooms.institution_id = school_events.institution_id
      where school_events.institution_id = ${input.institutionId}
        and school_events.starts_at::date >= current_date
        ${teacherWhere}
        ${parentWhere}
      order by school_events.starts_at asc
      limit ${input.limit ?? 5}
    `);

    return result.rows;
  }

  async countUnreadMessages(institutionId: string, userId: string) {
    return this.count(sql`
      select count(*)::int as count
      from messages
      where institution_id = ${institutionId}
        and recipient_user_id = ${userId}
        and read_at is null
    `);
  }

  async listRecentMessages(institutionId: string, userId: string, limit = 5) {
    const result = await this.db.execute<MessageRow>(sql`
      select
        messages.id,
        message_threads.subject,
        messages.body,
        messages.read_at as "readAt",
        messages.created_at as "createdAt"
      from messages
      inner join message_threads
        on message_threads.id = messages.thread_id
       and message_threads.institution_id = messages.institution_id
      where messages.institution_id = ${institutionId}
        and messages.recipient_user_id = ${userId}
      order by messages.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listReportHistory(institutionId: string, limit = 10) {
    const result = await this.db.execute<ReportHistoryRow>(sql`
      select
        report_history.id,
        report_history.student_id as "studentId",
        concat(students.first_name, ' ', students.last_name) as "studentName",
        report_history.year,
        report_history.report_type as "reportType",
        report_history.created_at as "createdAt"
      from report_history
      inner join students
        on students.id = report_history.student_id
       and students.institution_id = report_history.institution_id
      where report_history.institution_id = ${institutionId}
      order by report_history.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  private async count(query: ReturnType<typeof sql>) {
    const result = await this.db.execute<CountRow>(query);
    return this.toCount(result.rows[0]?.count);
  }

  private toAttendanceSummary(row: AttendanceSummaryRow | undefined) {
    return {
      present: this.toCount(row?.present),
      late: this.toCount(row?.late),
      absent: this.toCount(row?.absent),
      marked: this.toCount(row?.marked),
    };
  }

  private toCount(value: string | number | undefined) {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value ?? 0);
  }
}
