import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

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
  constructor(private readonly db: NodePgDatabase) {}

  // The single configuration row of the school: the oldest row, ties by lowest
  // id, the same rule as AuthRepository.findAuthContext.
  async getInstitutionContext() {
    const result = await this.db.execute<InstitutionContextRow>(sql`
      select id, name
      from institutions
      order by created_at asc nulls last, id asc
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async countStudents() {
    return this.count(sql`
      select count(*)::int as count
      from students
    `);
  }

  async countGuardians() {
    return this.count(sql`
      select count(*)::int as count
      from guardians
    `);
  }

  async countUsersByRole(role: string) {
    return this.count(sql`
      select count(*)::int as count
      from user_roles
      where role = ${role}
    `);
  }

  async countActiveEnrollments(teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = enrollments.classroom_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    return this.count(sql`
      select count(*)::int as count
      from enrollments
      ${assignmentJoin}
      where enrollments.status = 'active'
    `);
  }

  async countClassrooms() {
    return this.count(sql`
      select count(*)::int as count
      from classrooms
    `);
  }

  async getActiveAcademicPeriod() {
    const result = await this.db.execute<ActivePeriodRow>(sql`
      select
        id,
        year,
        term,
        start_date as "startDate",
        end_date as "endDate"
      from academic_periods
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

  async getTodayAttendanceSummary(teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join enrollments e
          on e.id = attendance.enrollment_id
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<AttendanceSummaryRow>(sql`
      select
        count(*) filter (where attendance.status = 'present')::int as present,
        count(*) filter (where attendance.status = 'late')::int as late,
        count(*) filter (where attendance.status = 'absent')::int as absent,
        count(*)::int as marked
      from attendance
      ${assignmentJoin}
      where attendance.date::date = current_date
    `);

    return this.toAttendanceSummary(result.rows[0]);
  }

  async getGradeSubmissionSummary(
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
      where e.academic_period_id = ${academicPeriodId}
        and e.status = 'active'
    `);

    const row = result.rows[0];

    return {
      submitted: this.toCount(row?.submitted),
      total: this.toCount(row?.total),
    };
  }

  async listFeatureStatuses() {
    const result = await this.db.execute<FeatureStatusRow>(sql`
      select
        key,
        default_value as enabled,
        'default' as source
      from feature_flags
      order by key asc
    `);

    return result.rows.filter((flag) => flag.key !== 'billing_module');
  }

  async listExtensionStatuses() {
    const result = await this.db.execute<ExtensionStatusRow>(sql`
      select
        key,
        name,
        (coalesce(enabled, false) and config is not null) as enabled
      from extensions
      order by key asc
    `);

    return result.rows;
  }

  async listRecentNotifications(input: {
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
              where gul.user_id = ${input.userId}
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
              where tca.teacher_user_id = ${input.userId}
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
      where ${roleFilter}
        ${parentFilter}
        ${teacherFilter}
      order by created_at desc
      limit ${input.limit ?? 5}
    `);

    return result.rows;
  }

  async listRecentAuditActivity(limit = 5) {
    const result = await this.db.execute<AuditActivityRow>(sql`
      select
        id,
        action,
        entity,
        entity_id as "entityId",
        created_at as "createdAt"
      from audit_logs
      order by created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listClassroomSnapshots(teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = c.id
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
       and e.status = 'active'
      left join attendance a
        on a.enrollment_id = e.id
       and a.date::date = current_date
      group by c.id, c.grade_level, c.section
      order by c.grade_level asc, c.section asc
    `);

    return result.rows;
  }

  async listRecentGrades(limit = 5, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<RecentGradeRow>(sql`
      select
        g.id,
        subjects.name as subject,
        g.score,
        g.created_at as "createdAt",
        s.id as "studentId",
        concat_ws(' ', s.first_name, s.second_name, s.first_last_name, s.second_last_name) as "studentName"
      from grades g
      inner join subjects on subjects.id = g.subject_id
      inner join enrollments e
        on e.id = g.enrollment_id
      ${assignmentJoin}
      inner join students s
        on s.id = e.student_id
      order by g.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listStudentsAtRisk(limit = 5, teacherUserId?: string) {
    const assignmentJoin = teacherUserId
      ? sql`
        inner join teacher_classroom_assignments tca
          on tca.classroom_id = e.classroom_id
         and tca.teacher_user_id = ${teacherUserId}
      `
      : sql``;

    const result = await this.db.execute<StudentRiskRow>(sql`
      select
        s.id as "studentId",
        concat_ws(' ', s.first_name, s.second_name, s.first_last_name, s.second_last_name) as "studentName",
        concat('Grade ', c.grade_level, coalesce(' ' || c.section, '')) as "classroomName",
        avg(g.score)::numeric(10,2) as average,
        count(a.id) filter (where a.status = 'absent')::int as absences
      from students s
      inner join enrollments e
        on e.student_id = s.id
       and e.status = 'active'
      ${assignmentJoin}
      left join classrooms c
        on c.id = e.classroom_id
      left join grades g
        on g.enrollment_id = e.id
      left join attendance a
        on a.enrollment_id = e.id
      group by s.id, c.grade_level, c.section
      having avg(g.score) < 80
          or count(a.id) filter (where a.status = 'absent') > 0
      order by
        count(a.id) filter (where a.status = 'absent') desc,
        avg(g.score) asc nulls last
      limit ${limit}
    `);

    return result.rows;
  }

  async listParentStudents(userId: string) {
    const result = await this.db.execute<ParentStudentRow>(sql`
      select distinct on (s.id)
        s.id as "studentId",
        concat_ws(' ', s.first_name, s.second_name, s.first_last_name, s.second_last_name) as "fullName",
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
       and gul.user_id = ${userId}
      inner join guardians g
        on g.id = sg.guardian_id
      inner join students s
        on s.id = sg.student_id
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
        left join classrooms c
          on c.id = e.classroom_id
        where e.student_id = s.id
        order by
          case when e.status = 'active' then 0 else 1 end,
          ap.year desc,
          ap.term desc
        limit 1
      ) latest_enrollment on true
      order by s.id, g.name asc
    `);

    return result.rows;
  }

  async getStudentAverage(studentId: string, year: number) {
    const result = await this.db.execute<StudentAverageRow>(sql`
      select
        avg(g.score)::numeric(10,2) as average,
        count(g.id)::int as "gradeCount"
      from grades g
      inner join subjects on subjects.id = g.subject_id
      inner join enrollments e
        on e.id = g.enrollment_id
      inner join academic_periods ap
        on ap.id = e.academic_period_id
      where e.student_id = ${studentId}
        and ap.year = ${year}
    `);

    const row = result.rows[0];

    return {
      average: row?.average === null || row?.average === undefined ? null : Number(row.average),
      gradeCount: this.toCount(row?.gradeCount),
    };
  }

  async getStudentAttendanceSummary(studentId: string) {
    const result = await this.db.execute<AttendanceSummaryRow>(sql`
      select
        count(*) filter (where a.status = 'present')::int as present,
        count(*) filter (where a.status = 'late')::int as late,
        count(*) filter (where a.status = 'absent')::int as absent,
        count(*)::int as marked
      from attendance a
      inner join enrollments e
        on e.id = a.enrollment_id
      where e.student_id = ${studentId}
    `);

    return this.toAttendanceSummary(result.rows[0]);
  }

  async listStudentRecentGrades(studentId: string, limit = 3) {
    const result = await this.db.execute<RecentGradeRow>(sql`
      select
        g.id,
        subjects.name as subject,
        g.score,
        g.created_at as "createdAt",
        s.id as "studentId",
        concat_ws(' ', s.first_name, s.second_name, s.first_last_name, s.second_last_name) as "studentName"
      from grades g
      inner join subjects on subjects.id = g.subject_id
      inner join enrollments e
        on e.id = g.enrollment_id
      inner join students s
        on s.id = e.student_id
      where s.id = ${studentId}
      order by g.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listUpcomingAssignments(input: {
    role: string;
    userId?: string;
    limit?: number;
  }) {
    const teacherJoin =
      input.role === 'teacher' && input.userId
        ? sql`
          inner join teacher_classroom_assignments tca
            on tca.classroom_id = assignments.classroom_id
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
             and e.classroom_id = assignments.classroom_id
             and e.status = 'active'
            where gul.user_id = ${input.userId}
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
      where assignments.status = 'published'
        ${parentWhere}
      order by assignments.due_date asc nulls last, assignments.created_at desc
      limit ${input.limit ?? 5}
    `);

    return result.rows;
  }

  async listUpcomingEvents(input: {
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
               and e.classroom_id = school_events.classroom_id
               and e.status = 'active'
              where gul.user_id = ${input.userId}
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
      where school_events.starts_at::date >= current_date
        ${teacherWhere}
        ${parentWhere}
      order by school_events.starts_at asc
      limit ${input.limit ?? 5}
    `);

    return result.rows;
  }

  async countUnreadMessages(userId: string) {
    return this.count(sql`
      select count(*)::int as count
      from messages
      where recipient_user_id = ${userId}
        and read_at is null
    `);
  }

  async listRecentMessages(userId: string, limit = 5) {
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
      where messages.recipient_user_id = ${userId}
      order by messages.created_at desc
      limit ${limit}
    `);

    return result.rows;
  }

  async listReportHistory(limit = 10) {
    const result = await this.db.execute<ReportHistoryRow>(sql`
      select
        report_history.id,
        report_history.student_id as "studentId",
        concat_ws(' ', students.first_name, students.second_name, students.first_last_name, students.second_last_name) as "studentName",
        report_history.year,
        report_history.report_type as "reportType",
        report_history.created_at as "createdAt"
      from report_history
      inner join students
        on students.id = report_history.student_id
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
