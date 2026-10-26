import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type ClassroomActivityTotalsRow = {
  classroomId: string;
  gradeLevel: number;
  section: string | null;
  teacherCount: number;
  activeStudents: number;
  gradesRecorded: number;
  gradeAverage: number | null;
  attendanceMarked: number;
  absences: number;
  lates: number;
  assignmentsCreated: number;
  eventsScheduled: number;
  lastActivityAt: Date | null;
};

export type ClassroomActivityItemRow = {
  type: 'grade' | 'attendance' | 'assignment' | 'event';
  id: string;
  occurredAt: Date;
  studentId: string | null;
  studentName: string | null;
  summary: string;
};

// What was recorded in a classroom: grades and attendance marks of its
// enrollments, its assignments and its events, by created_at. School-wide
// assignments and events (no classroom) belong to no classroom.
export class ClassroomActivityRepository {
  constructor(private readonly db: NodePgDatabase) {}

  // One row per classroom (or only `classroomId`): counts since `since`, plus
  // the time of the latest activity ever recorded.
  async listTotals(input: { since: Date; classroomId?: string }) {
    const where = input.classroomId
      ? sql`where c.id = ${input.classroomId}`
      : sql``;

    const result = await this.db.execute<ClassroomActivityTotalsRow>(sql`
      select
        c.id as "classroomId",
        c.grade_level as "gradeLevel",
        c.section,
        (select count(*) from teacher_classroom_assignments t
          where t.classroom_id = c.id)::int as "teacherCount",
        (select count(distinct e.student_id) from enrollments e
          where e.classroom_id = c.id and e.status = 'active')::int as "activeStudents",
        coalesce(grades.recorded, 0)::int as "gradesRecorded",
        grades.average as "gradeAverage",
        coalesce(marks.marked, 0)::int as "attendanceMarked",
        coalesce(marks.absences, 0)::int as absences,
        coalesce(marks.lates, 0)::int as lates,
        (select count(*) from assignments a
          where a.classroom_id = c.id and a.created_at >= ${input.since})::int
          as "assignmentsCreated",
        (select count(*) from school_events ev
          where ev.classroom_id = c.id and ev.created_at >= ${input.since})::int
          as "eventsScheduled",
        greatest(
          (select max(g.created_at) from grades g
            inner join enrollments e on e.id = g.enrollment_id
            where e.classroom_id = c.id),
          (select max(at.created_at) from attendance at
            inner join enrollments e on e.id = at.enrollment_id
            where e.classroom_id = c.id),
          (select max(a.created_at) from assignments a where a.classroom_id = c.id),
          (select max(ev.created_at) from school_events ev where ev.classroom_id = c.id)
        ) as "lastActivityAt"
      from classrooms c
      left join lateral (
        select count(*) as recorded, round(avg(g.score))::int as average
        from grades g
        inner join enrollments e on e.id = g.enrollment_id
        where e.classroom_id = c.id and g.created_at >= ${input.since}
      ) grades on true
      left join lateral (
        select
          count(*) as marked,
          count(*) filter (where at.status = 'absent') as absences,
          count(*) filter (where at.status = 'late') as lates
        from attendance at
        inner join enrollments e on e.id = at.enrollment_id
        where e.classroom_id = c.id and at.created_at >= ${input.since}
      ) marks on true
      ${where}
      order by c.grade_level asc, c.section asc nulls first, c.id asc
    `);

    return result.rows;
  }

  // The latest activity of one classroom, newest first.
  async listRecent(input: { classroomId: string; since: Date; limit: number }) {
    const result = await this.db.execute<ClassroomActivityItemRow>(sql`
      select type, id, "occurredAt", "studentId", "studentName", summary
      from (
        select
          'grade' as type,
          g.id,
          g.created_at as "occurredAt",
          st.id as "studentId",
          trim(st.first_name || ' ' || st.last_name) as "studentName",
          s.name || ': ' || g.score as summary
        from grades g
        inner join enrollments e on e.id = g.enrollment_id
        inner join students st on st.id = e.student_id
        inner join subjects s on s.id = g.subject_id
        where e.classroom_id = ${input.classroomId}
          and g.created_at >= ${input.since}
        union all
        select
          'attendance',
          at.id,
          at.created_at,
          st.id,
          trim(st.first_name || ' ' || st.last_name),
          at.status
        from attendance at
        inner join enrollments e on e.id = at.enrollment_id
        inner join students st on st.id = e.student_id
        where e.classroom_id = ${input.classroomId}
          and at.created_at >= ${input.since}
        union all
        select 'assignment', a.id, a.created_at, null::uuid, null::text, a.title
        from assignments a
        where a.classroom_id = ${input.classroomId}
          and a.created_at >= ${input.since}
        union all
        select 'event', ev.id, ev.created_at, null::uuid, null::text, ev.title
        from school_events ev
        where ev.classroom_id = ${input.classroomId}
          and ev.created_at >= ${input.since}
      ) activity
      order by "occurredAt" desc, id desc
      limit ${input.limit}
    `);

    return result.rows;
  }
}
