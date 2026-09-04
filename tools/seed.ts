import { db } from '../libs/db/src/index.js';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../libs/domain/src/auth/application/password.js';
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
  grades,
  guardianUserLinks,
  institutionFeatureFlags,
  institutionExtensions,
  institutions,
  messages,
  messageThreads,
  notifications,
  reportHistory,
  schoolEvents,
  studentGuardians,
  teacherClassroomAssignments,
  userInstitutionRoles,
  users,
  students,
} from '../libs/db/src/schema/index.js';

const ids = {
  institutions: {
    central: '00000000-0000-0000-0000-000000000001',
    north: '00000000-0000-0000-0000-000000000002',
  },
  users: {
    centralAdmin: '70000000-0000-0000-0000-000000000001',
    centralTeacher: '70000000-0000-0000-0000-000000000002',
    centralParent: '70000000-0000-0000-0000-000000000003',
    northAdmin: '70000000-0000-0000-0000-000000000004',
  },
  userInstitutionRoles: {
    centralAdmin: '71000000-0000-0000-0000-000000000001',
    centralTeacher: '71000000-0000-0000-0000-000000000002',
    centralParent: '71000000-0000-0000-0000-000000000003',
    northAdmin: '71000000-0000-0000-0000-000000000004',
  },
  academicPeriods: {
    centralTerm1: '10000000-0000-0000-0000-000000000001',
    centralTerm2: '10000000-0000-0000-0000-000000000002',
    northTerm1: '10000000-0000-0000-0000-000000000003',
    centralTerm3: '10000000-0000-0000-0000-000000000004',
  },
  classrooms: {
    central5A: '20000000-0000-0000-0000-000000000001',
    central5B: '20000000-0000-0000-0000-000000000002',
    north6A: '20000000-0000-0000-0000-000000000003',
  },
  students: {
    johnDoe: '30000000-0000-0000-0000-000000000001',
    janeSmith: '30000000-0000-0000-0000-000000000002',
    mariaLopez: '30000000-0000-0000-0000-000000000003',
  },
  enrollments: {
    johnCentralT1: '40000000-0000-0000-0000-000000000001',
    janeCentralT1: '40000000-0000-0000-0000-000000000002',
    mariaNorthT1: '40000000-0000-0000-0000-000000000003',
    johnCentralT3: '40000000-0000-0000-0000-000000000004',
    janeCentralT3: '40000000-0000-0000-0000-000000000005',
  },
  grades: {
    johnMath: '50000000-0000-0000-0000-000000000001',
    janeScience: '50000000-0000-0000-0000-000000000002',
    mariaHistory: '50000000-0000-0000-0000-000000000003',
    johnScience: '50000000-0000-0000-0000-000000000004',
    johnReading: '50000000-0000-0000-0000-000000000005',
    janeMath: '50000000-0000-0000-0000-000000000006',
    janeReading: '50000000-0000-0000-0000-000000000007',
  },
  attendance: {
    johnPresent: '60000000-0000-0000-0000-000000000001',
    janeLate: '60000000-0000-0000-0000-000000000002',
    mariaAbsent: '60000000-0000-0000-0000-000000000003',
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

export async function seedDatabase() {
  console.log('Seeding database...');
  const hashedAdminPassword = hashPassword('admin1234');
  const hashedTeacherPassword = hashPassword('teacher1234');
  const hashedParentPassword = hashPassword('parent1234');

  await db
    .insert(institutions)
    .values([
      {
        id: ids.institutions.central,
        name: 'Colegio Central',
      },
      {
        id: ids.institutions.north,
        name: 'Instituto del Norte',
      },
    ])
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
        id: ids.users.northAdmin,
        email: 'admin@north.edu',
        passwordHash: hashedAdminPassword,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(userInstitutionRoles)
    .values([
      {
        id: ids.userInstitutionRoles.centralAdmin,
        userId: ids.users.centralAdmin,
        institutionId: ids.institutions.central,
        role: 'admin',
      },
      {
        id: ids.userInstitutionRoles.centralTeacher,
        userId: ids.users.centralTeacher,
        institutionId: ids.institutions.central,
        role: 'teacher',
      },
      {
        id: ids.userInstitutionRoles.centralParent,
        userId: ids.users.centralParent,
        institutionId: ids.institutions.central,
        role: 'parent',
      },
      {
        id: ids.userInstitutionRoles.northAdmin,
        userId: ids.users.northAdmin,
        institutionId: ids.institutions.north,
        role: 'admin',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(featureFlags)
    .values([
      { key: 'billing_module', defaultValue: false },
      { key: 'assignments_module', defaultValue: false },
      { key: 'calendar_module', defaultValue: false },
      { key: 'custom_fields', defaultValue: false },
      { key: 'messaging_module', defaultValue: false },
      { key: 'parent_portal', defaultValue: false },
      { key: 'reports_pdf', defaultValue: false },
      { key: 'teacher_gradebook', defaultValue: true },
    ])
    .onConflictDoNothing();

  await db
    .insert(institutionFeatureFlags)
    .values([
      {
        institutionId: ids.institutions.central,
        featureKey: 'billing_module',
        enabled: false,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'assignments_module',
        enabled: true,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'calendar_module',
        enabled: true,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'parent_portal',
        enabled: true,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'reports_pdf',
        enabled: true,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'custom_fields',
        enabled: true,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'messaging_module',
        enabled: true,
      },
      {
        institutionId: ids.institutions.central,
        featureKey: 'teacher_gradebook',
        enabled: true,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'billing_module',
        enabled: false,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'assignments_module',
        enabled: true,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'calendar_module',
        enabled: true,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'parent_portal',
        enabled: true,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'reports_pdf',
        enabled: true,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'custom_fields',
        enabled: true,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'messaging_module',
        enabled: true,
      },
    ])
    .onConflictDoUpdate({
      target: [
        institutionFeatureFlags.institutionId,
        institutionFeatureFlags.featureKey,
      ],
      set: {
        enabled: sql`excluded.enabled`,
      },
    });

  await db
    .insert(extensions)
    .values([
      {
        key: 'notifications',
        name: 'Notifications',
        enabled: true,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(institutionExtensions)
    .values([
      {
        institutionId: ids.institutions.central,
        extensionKey: 'notifications',
        config: {},
      },
      {
        institutionId: ids.institutions.north,
        extensionKey: 'notifications',
        config: {},
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(academicPeriods)
    .values([
      {
        id: ids.academicPeriods.centralTerm1,
        institutionId: ids.institutions.central,
        year: 2026,
        term: 1,
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.000Z'),
      },
      {
        id: ids.academicPeriods.centralTerm2,
        institutionId: ids.institutions.central,
        year: 2026,
        term: 2,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T23:59:59.000Z'),
      },
      {
        id: ids.academicPeriods.northTerm1,
        institutionId: ids.institutions.north,
        year: 2026,
        term: 1,
        startDate: new Date('2026-01-10T00:00:00.000Z'),
        endDate: new Date('2026-03-28T23:59:59.000Z'),
      },
      {
        id: ids.academicPeriods.centralTerm3,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        gradeLevel: 5,
        section: 'A',
      },
      {
        id: ids.classrooms.central5B,
        institutionId: ids.institutions.central,
        gradeLevel: 5,
        section: 'B',
      },
      {
        id: ids.classrooms.north6A,
        institutionId: ids.institutions.north,
        gradeLevel: 6,
        section: 'A',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(students)
    .values([
      {
        id: ids.students.johnDoe,
        institutionId: ids.institutions.central,
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '2014-02-12',
      },
      {
        id: ids.students.janeSmith,
        institutionId: ids.institutions.central,
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '2013-08-24',
      },
      {
        id: ids.students.mariaLopez,
        institutionId: ids.institutions.north,
        firstName: 'Maria',
        lastName: 'Lopez',
        dateOfBirth: '2012-11-03',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(enrollments)
    .values([
      {
        id: ids.enrollments.johnCentralT1,
        institutionId: ids.institutions.central,
        studentId: ids.students.johnDoe,
        academicPeriodId: ids.academicPeriods.centralTerm1,
        classroomId: ids.classrooms.central5A,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.janeCentralT1,
        institutionId: ids.institutions.central,
        studentId: ids.students.janeSmith,
        academicPeriodId: ids.academicPeriods.centralTerm1,
        classroomId: ids.classrooms.central5B,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.mariaNorthT1,
        institutionId: ids.institutions.north,
        studentId: ids.students.mariaLopez,
        academicPeriodId: ids.academicPeriods.northTerm1,
        classroomId: ids.classrooms.north6A,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.johnCentralT3,
        institutionId: ids.institutions.central,
        studentId: ids.students.johnDoe,
        academicPeriodId: ids.academicPeriods.centralTerm3,
        classroomId: ids.classrooms.central5A,
        status: 'active',
        promotionStatus: null,
      },
      {
        id: ids.enrollments.janeCentralT3,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        name: 'Ana Doe',
        phone: '+50255551001',
      },
      {
        id: ids.guardians.janeFamily,
        institutionId: ids.institutions.central,
        name: 'Carlos Smith',
        phone: '+50255551002',
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
        institutionId: ids.institutions.central,
        guardianId: ids.guardians.centralFamily,
        userId: ids.users.centralParent,
      },
      {
        institutionId: ids.institutions.central,
        guardianId: ids.guardians.janeFamily,
        userId: ids.users.centralParent,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(teacherClassroomAssignments)
    .values([
      {
        institutionId: ids.institutions.central,
        teacherUserId: ids.users.centralTeacher,
        classroomId: ids.classrooms.central5A,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(grades)
    .values([
      {
        id: ids.grades.johnMath,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.johnCentralT1,
        subject: 'Mathematics',
        score: 88,
      },
      {
        id: ids.grades.janeScience,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.janeCentralT1,
        subject: 'Science',
        score: 93,
      },
      {
        id: ids.grades.mariaHistory,
        institutionId: ids.institutions.north,
        enrollmentId: ids.enrollments.mariaNorthT1,
        subject: 'History',
        score: 81,
      },
      {
        id: ids.grades.johnScience,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.johnCentralT3,
        subject: 'Science',
        score: 91,
      },
      {
        id: ids.grades.johnReading,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.johnCentralT3,
        subject: 'Reading',
        score: 84,
      },
      {
        id: ids.grades.janeMath,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.janeCentralT3,
        subject: 'Mathematics',
        score: 78,
      },
      {
        id: ids.grades.janeReading,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.janeCentralT3,
        subject: 'Reading',
        score: 96,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(attendance)
    .values([
      {
        id: ids.attendance.johnPresent,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.johnCentralT1,
        date: new Date('2026-01-20T08:00:00.000Z'),
        status: 'present',
      },
      {
        id: ids.attendance.janeLate,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.janeCentralT1,
        date: new Date('2026-01-20T08:00:00.000Z'),
        status: 'late',
      },
      {
        id: ids.attendance.mariaAbsent,
        institutionId: ids.institutions.north,
        enrollmentId: ids.enrollments.mariaNorthT1,
        date: new Date('2026-01-21T08:00:00.000Z'),
        status: 'absent',
      },
      {
        id: ids.attendance.johnTodayPresent,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.johnCentralT3,
        date: new Date('2026-07-02T08:00:00.000Z'),
        status: 'present',
      },
      {
        id: ids.attendance.janeTodayAbsent,
        institutionId: ids.institutions.central,
        enrollmentId: ids.enrollments.janeCentralT3,
        date: new Date('2026-07-02T08:00:00.000Z'),
        status: 'absent',
      },
      {
        id: ids.attendance.johnYesterdayLate,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        userId: ids.users.centralAdmin,
        action: 'create',
        entity: 'demo',
        entityId: ids.institutions.central,
        before: null,
        after: { modules: 'enabled' },
      },
      {
        id: ids.auditLogs.attendanceMarked,
        institutionId: ids.institutions.central,
        userId: ids.users.centralTeacher,
        action: 'create',
        entity: 'attendance',
        entityId: ids.attendance.janeTodayAbsent,
        before: null,
        after: { status: 'absent' },
      },
      {
        id: ids.auditLogs.gradeSubmitted,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        entity: 'students',
        name: 'Scholarship',
        type: 'boolean',
      },
      {
        id: ids.customFields.busRoute,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        classroomId: ids.classrooms.central5A,
        createdByUserId: ids.users.centralTeacher,
        title: 'Fractions practice',
        type: 'homework',
        status: 'published',
        dueDate: new Date('2026-07-05T23:59:59.000Z'),
      },
      {
        id: ids.assignments.scienceExam,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        classroomId: ids.classrooms.central5A,
        createdByUserId: ids.users.centralAdmin,
        title: 'Parent check-in afternoon',
        eventType: 'meeting',
        startsAt: new Date('2026-07-10T15:00:00.000Z'),
        endsAt: new Date('2026-07-10T17:00:00.000Z'),
      },
      {
        id: ids.events.readingDay,
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
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
        institutionId: ids.institutions.central,
        studentId: ids.students.johnDoe,
        year: 2026,
        reportType: 'academic_summary',
        createdByUserId: ids.users.centralAdmin,
      },
      {
        id: ids.reportHistory.janeSummary,
        institutionId: ids.institutions.central,
        studentId: ids.students.janeSmith,
        year: 2026,
        reportType: 'academic_summary',
        createdByUserId: ids.users.centralAdmin,
      },
    ])
    .onConflictDoNothing();

  console.log('Seed complete');
}

seedDatabase().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
