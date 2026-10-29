import dotenv from 'dotenv';
import { db as defaultDb } from '../libs/db/src/index.js';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hashPassword } from '../libs/domain/src/auth/application/password.js';
import { getCliErrorMessage, parseFlags, renderHelp, requireEnv } from './cli-utils.js';
import {
  academicPeriods,
  assignments,
  auditLogs,
  attendance,
  classrooms,
  customFields,
  customFieldValues,
  enrollments,
  extensions,
  featureFlags,
  guardians,
  classroomSubjects,
  grades,
  guardianUserLinks,
  institutions,
  messages,
  messageThreads,
  notifications,
  reportHistory,
  schoolEvents,
  studentGuardians,
  teacherClassroomAssignments,
  userRoles,
  users,
  students,
  subjects,
  subjectTeachers,
} from '../libs/db/src/schema/index.js';

const ids = {
  institution: '00000000-0000-0000-0000-000000000001',
  users: {
    centralAdmin: '70000000-0000-0000-0000-000000000001',
    centralTeacher: '70000000-0000-0000-0000-000000000002',
    centralParent: '70000000-0000-0000-0000-000000000003',
    centralViceDirector: '70000000-0000-0000-0000-000000000004',
    centralSubdirector: '70000000-0000-0000-0000-000000000005',
  },
  userRoles: {
    centralAdmin: '72000000-0000-0000-0000-000000000001',
    centralTeacher: '72000000-0000-0000-0000-000000000002',
    centralParent: '72000000-0000-0000-0000-000000000003',
    centralViceDirector: '72000000-0000-0000-0000-000000000004',
    centralSubdirector: '72000000-0000-0000-0000-000000000005',
  },
  academicPeriods: {
    centralTerm1: '10000000-0000-0000-0000-000000000001',
    centralTerm2: '10000000-0000-0000-0000-000000000002',
    centralTerm3: '10000000-0000-0000-0000-000000000004',
  },
  classrooms: {
    central5A: '20000000-0000-0000-0000-000000000001',
    central5B: '20000000-0000-0000-0000-000000000002',
  },
  students: {
    johnDoe: '30000000-0000-0000-0000-000000000001',
    janeSmith: '30000000-0000-0000-0000-000000000002',
  },
  enrollments: {
    johnCentralT1: '40000000-0000-0000-0000-000000000001',
    janeCentralT1: '40000000-0000-0000-0000-000000000002',
    johnCentralT3: '40000000-0000-0000-0000-000000000004',
    janeCentralT3: '40000000-0000-0000-0000-000000000005',
  },
  subjects: {
    mathematics: '55000000-0000-4000-8000-000000000001',
    science: '55000000-0000-4000-8000-000000000002',
    history: '55000000-0000-4000-8000-000000000003',
    reading: '55000000-0000-4000-8000-000000000004',
  },
  grades: {
    johnMath: '50000000-0000-0000-0000-000000000001',
    janeScience: '50000000-0000-0000-0000-000000000002',
    johnScience: '50000000-0000-0000-0000-000000000004',
    johnReading: '50000000-0000-0000-0000-000000000005',
    janeMath: '50000000-0000-0000-0000-000000000006',
    janeReading: '50000000-0000-0000-0000-000000000007',
  },
  attendance: {
    johnPresent: '60000000-0000-0000-0000-000000000001',
    janeLate: '60000000-0000-0000-0000-000000000002',
    johnTodayPresent: '60000000-0000-0000-0000-000000000004',
    janeTodayAbsent: '60000000-0000-0000-0000-000000000005',
    johnYesterdayLate: '60000000-0000-0000-0000-000000000006',
  },
  guardians: {
    centralFamily: '80000000-0000-0000-0000-000000000001',
    janeFamily: '80000000-0000-0000-0000-000000000002',
  },
  notifications: {
    gradeSubmitted: '90000000-0000-0000-0000-000000000001',
    attendanceAlert: '90000000-0000-0000-0000-000000000002',
    reportReady: '90000000-0000-0000-0000-000000000003',
  },
  auditLogs: {
    demoSeeded: '91000000-0000-0000-0000-000000000001',
    attendanceMarked: '91000000-0000-0000-0000-000000000002',
    gradeSubmitted: '91000000-0000-0000-0000-000000000003',
  },
  customFields: {
    scholarship: '92000000-0000-0000-0000-000000000001',
    busRoute: '92000000-0000-0000-0000-000000000002',
  },
  assignments: {
    mathHomework: '93000000-0000-0000-0000-000000000001',
    scienceExam: '93000000-0000-0000-0000-000000000002',
  },
  events: {
    parentMeeting: '94000000-0000-0000-0000-000000000001',
    readingDay: '94000000-0000-0000-0000-000000000002',
  },
  messageThreads: {
    attendanceFollowup: '95000000-0000-0000-0000-000000000001',
  },
  messages: {
    attendanceFollowup: '96000000-0000-0000-0000-000000000001',
  },
  reportHistory: {
    johnSummary: '97000000-0000-0000-0000-000000000001',
    janeSummary: '97000000-0000-0000-0000-000000000002',
  },
};

// Seeds `db` (the DATABASE_URL database by default); the seed spec passes its
// scratch database.
export async function seedDatabase(db: NodePgDatabase = defaultDb) {
  console.log('Seeding database...');
  const hashedAdminPassword = hashPassword('ULJaEJT9j8y8DeAQ');
  const hashedTeacherPassword = hashPassword('37WTW9BZm2gnQkYn');
  const hashedParentPassword = hashPassword('NP7rLvCv7HjUTM5a');
  const hashedViceDirectorPassword = hashPassword('Vd8qKm2PxT5wRz4N');
  const hashedSubdirectorPassword = hashPassword('Sd3nHf7LcQ9yBv6J');

  // The single configuration row (name and sender identity). No other row
  // names the school: since migration 0015 there is no school column.
  await db
    .insert(institutions)
    .values({
      id: ids.institution,
      name: 'Colegio Central',
      // SI-R1: the school's sender identity, so the demo school can send.
      senderName: 'Colegio Central',
      replyToEmail: 'office@central.example.com',
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values([
      {
        id: ids.users.centralAdmin,
        email: 'admin@central.edu',
        passwordHash: hashedAdminPassword,
      },
      {
        id: ids.users.centralTeacher,
        email: 'teacher@central.edu',
        passwordHash: hashedTeacherPassword,
      },
      {
        id: ids.users.centralParent,
        email: 'parent@central.edu',
        passwordHash: hashedParentPassword,
      },
      {
        id: ids.users.centralViceDirector,
        email: 'vicedirector@central.edu',
        passwordHash: hashedViceDirectorPassword,
      },
      {
        id: ids.users.centralSubdirector,
        email: 'subdirector@central.edu',
        passwordHash: hashedSubdirectorPassword,
      },
    ])
    .onConflictDoNothing();

  // The single-school model reads the role from `user_roles` (one role per
  // user). Every role has a demo account; the vice director and the
  // subdirector share the director's administrative surface.
  await db
    .insert(userRoles)
    .values([
      {
        id: ids.userRoles.centralAdmin,
        userId: ids.users.centralAdmin,
        role: 'director',
      },
      {
        id: ids.userRoles.centralTeacher,
        userId: ids.users.centralTeacher,
        role: 'teacher',
      },
      {
        id: ids.userRoles.centralParent,
        userId: ids.users.centralParent,
        role: 'parent',
      },
      {
        id: ids.userRoles.centralViceDirector,
        userId: ids.users.centralViceDirector,
        role: 'vice_director',
      },
      {
        id: ids.userRoles.centralSubdirector,
        userId: ids.users.centralSubdirector,
        role: 'subdirector',
      },
    ])
    .onConflictDoNothing();

  // Flags are global (TEN-05): `default_value` is the value the whole school
  // sees. `email_notifications` stays off, so a demo database cannot send real
  // mail (FL-R1/D7).
  await db
    .insert(featureFlags)
    .values([
      { key: 'billing_module', defaultValue: false },
      { key: 'assignments_module', defaultValue: true },
      { key: 'calendar_module', defaultValue: true },
      { key: 'custom_fields', defaultValue: true },
      { key: 'messaging_module', defaultValue: true },
      { key: 'parent_portal', defaultValue: true },
      { key: 'reports_pdf', defaultValue: true },
      { key: 'teacher_gradebook', defaultValue: true },
      { key: 'email_notifications', defaultValue: false },
    ])
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { defaultValue: sql`excluded.default_value` },
    });

  await db
    .insert(extensions)
    .values([
      {
        key: 'notifications',
        name: 'Notifications',
        enabled: true,
        config: {},
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(academicPeriods)
    .values([
      {
        id: ids.academicPeriods.centralTerm1,
        year: 2026,
        term: 1,
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.000Z'),
      },
      {
        id: ids.academicPeriods.centralTerm2,
        year: 2026,
        term: 2,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T23:59:59.000Z'),
      },
      {
        id: ids.academicPeriods.centralTerm3,
        year: 2026,
        term: 3,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-09-30T23:59:59.000Z'),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(classrooms)
    .values([
      {
        id: ids.classrooms.central5A,
        gradeLevel: 5,
        section: 'A',
      },
      {
        id: ids.classrooms.central5B,
        gradeLevel: 5,
        section: 'B',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(students)
    .values([
      {
        id: ids.students.johnDoe,
        firstName: 'John',
        firstLastName: 'Doe',
        secondLastName: 'Rivera',
        dateOfBirth: '2014-02-12',
      },
      {
        id: ids.students.janeSmith,
        firstName: 'Jane',
        secondName: 'Marie',
        firstLastName: 'Smith',
        secondLastName: 'Castillo',
        dateOfBirth: '2013-08-24',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(enrollments)
    .values([
      {
        id: ids.enrollments.johnCentralT1,
        studentId: ids.students.johnDoe,
        academicPeriodId: ids.academicPeriods.centralTerm1,
        classroomId: ids.classrooms.central5A,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.janeCentralT1,
        studentId: ids.students.janeSmith,
        academicPeriodId: ids.academicPeriods.centralTerm1,
        classroomId: ids.classrooms.central5B,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.johnCentralT3,
        studentId: ids.students.johnDoe,
        academicPeriodId: ids.academicPeriods.centralTerm3,
        classroomId: ids.classrooms.central5A,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.janeCentralT3,
        studentId: ids.students.janeSmith,
        academicPeriodId: ids.academicPeriods.centralTerm3,
        classroomId: ids.classrooms.central5B,
        status: 'active',
        promotionStatus: null,
      },
    ])
    .onConflictDoNothing();

  await db.execute(sql`
    update enrollments
    set status = 'completed',
        promotion_status = 'promoted'
    where id in (
      ${ids.enrollments.johnCentralT1},
      ${ids.enrollments.janeCentralT1}
    )
  `);

  await db
    .insert(guardians)
    .values([
      {
        id: ids.guardians.centralFamily,
        name: 'Ana Doe',
        phone: '+50255551001',
        // GE-R1: demo contact address (example.com is reserved, so it can never
        // receive anything) — the panel shows it as a `guardian` recipient.
        email: 'ana.doe@example.com',
      },
      {
        id: ids.guardians.janeFamily,
        name: 'Carlos Smith',
        phone: '+50255551002',
        email: 'carlos.smith@example.com',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(studentGuardians)
    .values([
      {
        studentId: ids.students.johnDoe,
        guardianId: ids.guardians.centralFamily,
      },
      {
        studentId: ids.students.janeSmith,
        guardianId: ids.guardians.janeFamily,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(guardianUserLinks)
    .values([
      {
        guardianId: ids.guardians.centralFamily,
        userId: ids.users.centralParent,
      },
      {
        guardianId: ids.guardians.janeFamily,
        userId: ids.users.centralParent,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(teacherClassroomAssignments)
    .values([
      {
        teacherUserId: ids.users.centralTeacher,
        classroomId: ids.classrooms.central5A,
      },
    ])
    .onConflictDoNothing();

  // The catalog of materias. A grade points at one of them.
  await db
    .insert(subjects)
    .values([
      { id: ids.subjects.mathematics, name: 'Mathematics' },
      { id: ids.subjects.science, name: 'Science' },
      { id: ids.subjects.history, name: 'History' },
      { id: ids.subjects.reading, name: 'Reading' },
    ])
    .onConflictDoNothing();

  // A materia that already exists keeps its id, so the seed reads the ids
  // back instead of assuming its own.
  const subjectIds = new Map(
    (await db.select().from(subjects)).map((subject) => [
      subject.name,
      subject.id,
    ])
  );
  const subjectId = (name: string) => subjectIds.get(name) ?? '';

  // What each grade level offers, and what the teacher is responsible for.
  await db
    .insert(classroomSubjects)
    .values([
      {
        classroomId: ids.classrooms.central5A,
        subjectId: subjectId('Mathematics'),
      },
      {
        classroomId: ids.classrooms.central5A,
        subjectId: subjectId('Science'),
      },
      {
        classroomId: ids.classrooms.central5A,
        subjectId: subjectId('Reading'),
      },
      {
        classroomId: ids.classrooms.central5B,
        subjectId: subjectId('History'),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(subjectTeachers)
    .values([
      {
        subjectId: subjectId('Mathematics'),
        teacherUserId: ids.users.centralTeacher,
      },
      {
        subjectId: subjectId('Science'),
        teacherUserId: ids.users.centralTeacher,
      },
      {
        subjectId: subjectId('Reading'),
        teacherUserId: ids.users.centralTeacher,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(grades)
    .values([
      {
        id: ids.grades.johnMath,
        enrollmentId: ids.enrollments.johnCentralT1,
        subjectId: subjectId('Mathematics'),
        score: 88,
      },
      {
        id: ids.grades.janeScience,
        enrollmentId: ids.enrollments.janeCentralT1,
        subjectId: subjectId('Science'),
        score: 93,
      },
      {
        id: ids.grades.johnScience,
        enrollmentId: ids.enrollments.johnCentralT3,
        subjectId: subjectId('Science'),
        score: 91,
      },
      {
        id: ids.grades.johnReading,
        enrollmentId: ids.enrollments.johnCentralT3,
        subjectId: subjectId('Reading'),
        score: 84,
      },
      {
        id: ids.grades.janeMath,
        enrollmentId: ids.enrollments.janeCentralT3,
        subjectId: subjectId('Mathematics'),
        score: 78,
      },
      {
        id: ids.grades.janeReading,
        enrollmentId: ids.enrollments.janeCentralT3,
        subjectId: subjectId('Reading'),
        score: 96,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(attendance)
    .values([
      {
        id: ids.attendance.johnPresent,
        enrollmentId: ids.enrollments.johnCentralT1,
        date: new Date('2026-01-20T08:00:00.000Z'),
        status: 'present',
      },
      {
        id: ids.attendance.janeLate,
        enrollmentId: ids.enrollments.janeCentralT1,
        date: new Date('2026-01-20T08:00:00.000Z'),
        status: 'late',
      },
      {
        id: ids.attendance.johnTodayPresent,
        enrollmentId: ids.enrollments.johnCentralT3,
        date: new Date('2026-07-02T08:00:00.000Z'),
        status: 'present',
      },
      {
        id: ids.attendance.janeTodayAbsent,
        enrollmentId: ids.enrollments.janeCentralT3,
        date: new Date('2026-07-02T08:00:00.000Z'),
        status: 'absent',
      },
      {
        id: ids.attendance.johnYesterdayLate,
        enrollmentId: ids.enrollments.johnCentralT3,
        date: new Date('2026-07-01T08:00:00.000Z'),
        status: 'late',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(notifications)
    .values([
      {
        id: ids.notifications.gradeSubmitted,
        eventName: 'grade.submitted',
        title: 'Grades posted',
        message: 'Term 3 Mathematics and Reading scores are ready for review.',
        metadata: {
          audience: ['admin', 'teacher', 'parent'],
          studentIds: [ids.students.johnDoe, ids.students.janeSmith],
          classroomIds: [ids.classrooms.central5A, ids.classrooms.central5B],
        },
      },
      {
        id: ids.notifications.attendanceAlert,
        eventName: 'attendance.marked',
        title: 'Attendance needs review',
        message: 'One absence was recorded today in Grade 5 B.',
        metadata: {
          audience: ['admin', 'teacher'],
          classroomIds: [ids.classrooms.central5B],
        },
      },
      {
        id: ids.notifications.reportReady,
        eventName: 'report.ready',
        title: 'Academic summaries available',
        message: 'Family report PDFs are available for the demo students.',
        metadata: {
          audience: ['admin', 'parent'],
          feature: 'reports_pdf',
          studentIds: [ids.students.johnDoe, ids.students.janeSmith],
        },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(auditLogs)
    .values([
      {
        id: ids.auditLogs.demoSeeded,
        userId: ids.users.centralAdmin,
        action: 'create',
        entity: 'demo',
        entityId: ids.institution,
        before: null,
        after: { modules: 'enabled' },
      },
      {
        id: ids.auditLogs.attendanceMarked,
        userId: ids.users.centralTeacher,
        action: 'create',
        entity: 'attendance',
        entityId: ids.attendance.janeTodayAbsent,
        before: null,
        after: { status: 'absent' },
      },
      {
        id: ids.auditLogs.gradeSubmitted,
        userId: ids.users.centralTeacher,
        action: 'create',
        entity: 'grades',
        entityId: ids.grades.janeReading,
        before: null,
        after: { subject: 'Reading', score: 96 },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(customFields)
    .values([
      {
        id: ids.customFields.scholarship,
        entity: 'students',
        name: 'Scholarship',
        type: 'boolean',
      },
      {
        id: ids.customFields.busRoute,
        entity: 'students',
        name: 'Bus route',
        type: 'text',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(customFieldValues)
    .values([
      {
        fieldId: ids.customFields.scholarship,
        entityId: ids.students.johnDoe,
        value: true,
      },
      {
        fieldId: ids.customFields.busRoute,
        entityId: ids.students.janeSmith,
        value: 'Route 4',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(assignments)
    .values([
      {
        id: ids.assignments.mathHomework,
        classroomId: ids.classrooms.central5A,
        createdByUserId: ids.users.centralTeacher,
        title: 'Fractions practice',
        type: 'homework',
        status: 'published',
        dueDate: new Date('2026-07-05T23:59:59.000Z'),
      },
      {
        id: ids.assignments.scienceExam,
        classroomId: ids.classrooms.central5A,
        createdByUserId: ids.users.centralTeacher,
        title: 'Plants and ecosystems exam',
        type: 'exam',
        status: 'published',
        dueDate: new Date('2026-07-08T08:00:00.000Z'),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schoolEvents)
    .values([
      {
        id: ids.events.parentMeeting,
        classroomId: ids.classrooms.central5A,
        createdByUserId: ids.users.centralAdmin,
        title: 'Parent check-in afternoon',
        eventType: 'meeting',
        startsAt: new Date('2026-07-10T15:00:00.000Z'),
        endsAt: new Date('2026-07-10T17:00:00.000Z'),
      },
      {
        id: ids.events.readingDay,
        classroomId: null,
        createdByUserId: ids.users.centralAdmin,
        title: 'School reading day',
        eventType: 'school',
        startsAt: new Date('2026-07-12T08:00:00.000Z'),
        endsAt: new Date('2026-07-12T12:00:00.000Z'),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(messageThreads)
    .values([
      {
        id: ids.messageThreads.attendanceFollowup,
        subject: 'Attendance follow-up',
        createdByUserId: ids.users.centralTeacher,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(messages)
    .values([
      {
        id: ids.messages.attendanceFollowup,
        threadId: ids.messageThreads.attendanceFollowup,
        senderUserId: ids.users.centralTeacher,
        recipientUserId: ids.users.centralParent,
        body: 'Jane was absent today. Please confirm if she needs support catching up.',
        readAt: null,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(reportHistory)
    .values([
      {
        id: ids.reportHistory.johnSummary,
        studentId: ids.students.johnDoe,
        year: 2026,
        reportType: 'academic_summary',
        createdByUserId: ids.users.centralAdmin,
      },
      {
        id: ids.reportHistory.janeSummary,
        studentId: ids.students.janeSmith,
        year: 2026,
        reportType: 'academic_summary',
        createdByUserId: ids.users.centralAdmin,
      },
    ])
    .onConflictDoNothing();

  console.log('Seed complete');
}

// Importing this module (the seed spec does) must not run the CLI.
if (require.main === module) {
  dotenv.config();

  const flags = parseFlags(process.argv.slice(2), []);

  if (flags.help) {
    renderHelp(
      'Seed the database with initial data.',
      ['npm run db:seed'],
      [],
    );
    process.exit(0);
  }

  requireEnv('DATABASE_URL');

  seedDatabase().catch((error) => {
    console.error(getCliErrorMessage(error));
    process.exit(1);
  });
}
