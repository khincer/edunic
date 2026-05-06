import { db } from '@edunic/source/db';
import { hashPassword } from '../../src/modules/auth/application/password.js';
import {
  academicPeriods,
  attendance,
  classrooms,
  enrollments,
  guardians,
  grades,
  institutions,
  students,
  userInstitutionRoles,
  users,
} from '@edunic/source/db/schema';

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
  institutionId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
}) {
  const result = await db
    .insert(students)
    .values({
      id: nextId('20000000'),
      institutionId: input.institutionId,
      firstName: input.firstName ?? 'Jane',
      lastName: input.lastName ?? 'Doe',
      dateOfBirth: input.dateOfBirth ?? '2012-03-15',
    })
    .returning();

  return result[0];
}

export async function createGuardianFixture(input: {
  institutionId: string;
  name?: string;
  phone?: string | null;
}) {
  const result = await db
    .insert(guardians)
    .values({
      id: nextId('25000000'),
      institutionId: input.institutionId,
      name: input.name ?? 'Maria Lopez',
      phone: input.phone ?? '+50255550000',
    })
    .returning();

  return result[0];
}

export async function createUserFixture(input: {
  institutionId: string;
  role: 'admin' | 'teacher' | 'parent';
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

  await db.insert(userInstitutionRoles).values({
    id: nextId('16000000'),
    userId: user.id,
    institutionId: input.institutionId,
    role: input.role,
  });

  return {
    ...user,
    institutionId: input.institutionId,
    role: input.role,
    password: input.password ?? `${input.role}1234`,
  };
}

export async function createAcademicPeriodFixture(input: {
  institutionId: string;
  year?: number;
  term?: number;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const result = await db
    .insert(academicPeriods)
    .values({
      id: nextId('30000000'),
      institutionId: input.institutionId,
      year: input.year ?? 2026,
      term: input.term ?? 1,
      startDate: input.startDate ?? new Date('2026-01-15T00:00:00.000Z'),
      endDate: input.endDate ?? new Date('2026-03-31T00:00:00.000Z'),
    })
    .returning();

  return result[0];
}

export async function createClassroomFixture(input: {
  institutionId: string;
  gradeLevel?: number;
  section?: string | null;
}) {
  const result = await db
    .insert(classrooms)
    .values({
      id: nextId('40000000'),
      institutionId: input.institutionId,
      gradeLevel: input.gradeLevel ?? 5,
      section: input.section ?? 'A',
    })
    .returning();

  return result[0];
}

export async function createEnrollmentFixture(input: {
  institutionId: string;
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
      institutionId: input.institutionId,
      studentId: input.studentId,
      academicPeriodId: input.academicPeriodId,
      classroomId: input.classroomId ?? null,
      status: input.status ?? 'active',
      promotionStatus: input.promotionStatus ?? null,
    })
    .returning();

  return result[0];
}

export async function createGradeFixture(input: {
  institutionId: string;
  enrollmentId: string;
  subject?: string;
  score?: number;
}) {
  const result = await db
    .insert(grades)
    .values({
      id: nextId('60000000'),
      institutionId: input.institutionId,
      enrollmentId: input.enrollmentId,
      subject: input.subject ?? 'Mathematics',
      score: input.score ?? 90,
    })
    .returning();

  return result[0];
}

export async function createAttendanceFixture(input: {
  institutionId: string;
  enrollmentId: string;
  date?: Date;
  status?: 'present' | 'absent' | 'late';
}) {
  const result = await db
    .insert(attendance)
    .values({
      id: nextId('70000000'),
      institutionId: input.institutionId,
      enrollmentId: input.enrollmentId,
      date: input.date ?? new Date('2026-02-01T08:00:00.000Z'),
      status: input.status ?? 'present',
    })
    .returning();

  return result[0];
}
