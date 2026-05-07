import { db } from '../libs/db/src/index.js';
import { hashPassword } from '../apps/edunic-api/src/modules/auth/application/password.js';
import {
  academicPeriods,
  attendance,
  classrooms,
  enrollments,
  extensions,
  featureFlags,
  grades,
  institutionFeatureFlags,
  institutionExtensions,
  institutions,
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
  },
  grades: {
    johnMath: '50000000-0000-0000-0000-000000000001',
    janeScience: '50000000-0000-0000-0000-000000000002',
    mariaHistory: '50000000-0000-0000-0000-000000000003',
  },
  attendance: {
    johnPresent: '60000000-0000-0000-0000-000000000001',
    janeLate: '60000000-0000-0000-0000-000000000002',
    mariaAbsent: '60000000-0000-0000-0000-000000000003',
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
      { key: 'parent_portal', defaultValue: false },
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
        featureKey: 'parent_portal',
        enabled: false,
      },
      {
        institutionId: ids.institutions.north,
        featureKey: 'billing_module',
        enabled: false,
      },
    ])
    .onConflictDoNothing();

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
    ])
    .onConflictDoNothing();

  console.log('Seed complete');
}

seedDatabase().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
