import { eq } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { hashPassword } from '@edunic/source/domain/auth';
import {
  academicPeriods,
  assignments,
  attendance,
  auditLogs,
  classrooms,
  enrollments,
  guardians,
  grades,
  institutions,
  messageThreads,
  messages,
  notifications,
  schoolEvents,
  students,
  classroomSubjects,
  subjects,
  teacherClassroomAssignments,
  userRoles,
  users,
} from '@edunic/source/db/schema';

export type UserRole =
  | 'director'
  | 'vice_director'
  | 'subdirector'
  | 'teacher'
  | 'parent';

// Fixtures never write the school into a row: since migration 0015 no table
// has a school column. createInstitutionFixture only seeds the configuration
// row (name, sender identity, reply-to) for the specs that read it.
let idCounter = 1;

function nextId(prefix: string) {
  const suffix = String(idCounter++).padStart(12, '0');
  return `${prefix}-0000-4000-8000-${suffix}`;
}

export async function createInstitutionFixture(name = 'Test Institution') {
  const result = await db
    .insert(institutions)
    .values({
      id: nextId('10000000'),
      name,
    })
    .returning();

  return result[0];
}

export async function createStudentFixture(input: {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
}) {
  const result = await db
    .insert(students)
    .values({
      id: nextId('20000000'),
      firstName: input.firstName ?? 'Jane',
      lastName: input.lastName ?? 'Doe',
      dateOfBirth: input.dateOfBirth ?? '2012-03-15',
    })
    .returning();

  return result[0];
}

export async function createGuardianFixture(input: {
  name?: string;
  phone?: string | null;
  email?: string | null;
}) {
  const result = await db
    .insert(guardians)
    .values({
      id: nextId('25000000'),
      name: input.name ?? 'Maria Lopez',
      phone: input.phone ?? '+50255550000',
      email: input.email ?? null,
    })
    .returning();

  return result[0];
}

export async function createUserFixture(input: {
  role: UserRole;
  email?: string;
  password?: string;
}) {
  const userResult = await db
    .insert(users)
    .values({
      id: nextId('15000000'),
      email: input.email ?? `${input.role}-${idCounter}@example.com`,
      passwordHash: hashPassword(input.password ?? `${input.role}1234`),
    })
    .returning();

  const user = userResult[0];

  // The single-school model reads the role from `user_roles` (one role per
  // user).
  await db.insert(userRoles).values({
    id: nextId('17000000'),
    userId: user.id,
    role: input.role,
  });

  return {
    ...user,
    role: input.role,
    password: input.password ?? `${input.role}1234`,
  };
}

export async function createAcademicPeriodFixture(input: {
  year?: number;
  term?: number;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const result = await db
    .insert(academicPeriods)
    .values({
      id: nextId('30000000'),
      year: input.year ?? 2026,
      term: input.term ?? 1,
      startDate: input.startDate ?? new Date('2026-01-15T00:00:00.000Z'),
      endDate: input.endDate ?? new Date('2026-03-31T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}

export async function createClassroomFixture(input: {
  gradeLevel?: number;
  section?: string | null;
}) {
  const result = await db
    .insert(classrooms)
    .values({
      id: nextId('40000000'),
      gradeLevel: input.gradeLevel ?? 5,
      section: input.section ?? 'A',
    })
    .returning();

  return result[0];
}

export async function createTeacherClassroomAssignmentFixture(input: {
  teacherUserId: string;
  classroomId: string;
}) {
  const result = await db
    .insert(teacherClassroomAssignments)
    .values({
      teacherUserId: input.teacherUserId,
      classroomId: input.classroomId,
    })
    .returning();

  return result[0];
}

export async function createEnrollmentFixture(input: {
  studentId: string;
  academicPeriodId: string;
  classroomId?: string | null;
  status?: 'active' | 'withdrawn' | 'completed';
  promotionStatus?: string | null;
}) {
  const result = await db
    .insert(enrollments)
    .values({
      id: nextId('50000000'),
      studentId: input.studentId,
      academicPeriodId: input.academicPeriodId,
      classroomId: input.classroomId ?? null,
      status: input.status ?? 'active',
      promotionStatus: input.promotionStatus ?? null,
    })
    .returning();

  return result[0];
}

// A materia of the catalog, created the first time it is asked for.
export async function createSubjectFixture(name = 'Mathematics') {
  const existing = await db
    .select()
    .from(subjects)
    .where(eq(subjects.name, name))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const created = await db
    .insert(subjects)
    .values({ id: nextId('65000000'), name })
    .returning();

  return created[0];
}

// A materia offered in a grade level.
export async function createClassroomSubjectFixture(
  classroomId: string,
  subjectId: string
) {
  const result = await db
    .insert(classroomSubjects)
    .values({ classroomId, subjectId })
    .onConflictDoNothing()
    .returning();

  return result[0];
}

export async function createGradeFixture(input: {
  enrollmentId: string;
  subject?: string;
  score?: number;
}) {
  const subject = await createSubjectFixture(input.subject ?? 'Mathematics');

  const result = await db
    .insert(grades)
    .values({
      id: nextId('60000000'),
      enrollmentId: input.enrollmentId,
      subjectId: subject.id,
      score: input.score ?? 90,
    })
    .returning();

  return result[0];
}

export async function createAttendanceFixture(input: {
  enrollmentId: string;
  date?: Date;
  status?: 'present' | 'absent' | 'late';
}) {
  const result = await db
    .insert(attendance)
    .values({
      id: nextId('70000000'),
      enrollmentId: input.enrollmentId,
      date: input.date ?? new Date('2026-02-01T08:00:00.000Z'),
      status: input.status ?? 'present',
    })
    .returning();

  return result[0];
}

export async function createAuditLogFixture(input: {
  entity?: string;
  action?: string;
  createdAt?: Date;
}) {
  const result = await db
    .insert(auditLogs)
    .values({
      id: nextId('90000000'),
      action: input.action ?? 'create',
      entity: input.entity ?? 'students',
      createdAt: input.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}

export async function createAssignmentFixture(input: {
  title?: string;
  dueDate?: Date | null;
  createdAt?: Date;
}) {
  const result = await db
    .insert(assignments)
    .values({
      id: nextId('97000000'),
      title: input.title ?? 'Homework',
      type: 'assignment',
      status: 'published',
      dueDate: input.dueDate ?? null,
      createdAt: input.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}

export async function createSchoolEventFixture(input: {
  title?: string;
  startsAt?: Date;
  createdAt?: Date;
}) {
  const result = await db
    .insert(schoolEvents)
    .values({
      id: nextId('98000000'),
      title: input.title ?? 'School event',
      eventType: 'school',
      startsAt: input.startsAt ?? new Date('2026-02-01T00:00:00.000Z'),
      createdAt: input.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}

export async function createMessageFixture(input: {
  senderUserId: string;
  subject?: string;
  body?: string;
  createdAt?: Date;
}) {
  const thread = await db
    .insert(messageThreads)
    .values({
      id: nextId('99000000'),
      subject: input.subject ?? 'Thread subject',
      createdByUserId: input.senderUserId,
    })
    .returning();

  const result = await db
    .insert(messages)
    .values({
      id: nextId('99500000'),
      threadId: thread[0].id,
      senderUserId: input.senderUserId,
      body: input.body ?? 'Message body',
      createdAt: input.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}

export async function createNotificationFixture(input: {
  eventName?: string;
  title?: string;
  createdAt?: Date;
}) {
  const result = await db
    .insert(notifications)
    .values({
      id: nextId('95000000'),
      eventName: input.eventName ?? 'enrollment.created',
      title: input.title ?? 'Enrollment created',
      message: 'Fixture notification',
      metadata: null,
      createdAt: input.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}
