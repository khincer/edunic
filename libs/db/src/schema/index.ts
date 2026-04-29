import {
  sql,
} from 'drizzle-orm';
import {
  check,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';

/* =========================================================
   🏫 INSTITUTIONS
========================================================= */

export const institutions = pgTable('institutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

/* =========================================================
   👤 USERS & ROLES
========================================================= */

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userInstitutionRoles = pgTable(
  'user_institution_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    role: text('role').notNull(),
  },
  (t) => ({
    uniqueUserInstitution: unique().on(t.userId, t.institutionId),
  })
);

/* =========================================================
   👨‍🎓 STUDENTS
========================================================= */

export const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),

  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth'),

  createdAt: timestamp('created_at').defaultNow(),
});

/* =========================================================
   👪 GUARDIANS
========================================================= */

export const guardians = pgTable('guardians', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  name: text('name').notNull(),
  phone: text('phone'),
});

export const studentGuardians = pgTable(
  'student_guardians',
  {
    studentId: uuid('student_id').notNull().references(() => students.id),
    guardianId: uuid('guardian_id').notNull().references(() => guardians.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.guardianId] }),
  })
);

/* =========================================================
   📅 ACADEMIC STRUCTURE
========================================================= */

export const academicPeriods = pgTable(
  'academic_periods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    year: integer('year').notNull(),
    term: integer('term').notNull(), // 1–4
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
  },
  (t) => ({
    uniqueInstitutionYearTerm: unique().on(
      t.institutionId,
      t.year,
      t.term
    ),
    validTerm: check('academic_periods_term_check', sql`${t.term} between 1 and 4`),
    validDateRange: check(
      'academic_periods_date_range_check',
      sql`${t.startDate} is null or ${t.endDate} is null or ${t.startDate} <= ${t.endDate}`
    ),
  })
);

export const classrooms = pgTable(
  'classrooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    gradeLevel: integer('grade_level').notNull(),
    section: text('section'),
  },
  (t) => ({
    uniqueInstitutionGradeSection: unique().on(
      t.institutionId,
      t.gradeLevel,
      t.section
    ),
    validGradeLevel: check(
      'classrooms_grade_level_check',
      sql`${t.gradeLevel} > 0`
    ),
  })
);

/* =========================================================
   📚 ENROLLMENTS
========================================================= */

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    studentId: uuid('student_id').notNull().references(() => students.id),
    academicPeriodId: uuid('academic_period_id')
      .notNull()
      .references(() => academicPeriods.id),
    classroomId: uuid('classroom_id').references(() => classrooms.id),

    status: text('status').default('active'),
    promotionStatus: text('promotion_status'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueStudentPeriod: unique().on(
      t.studentId,
      t.academicPeriodId
    ),
    validStatus: check(
      'enrollments_status_check',
      sql`${t.status} in ('active', 'withdrawn', 'completed')`
    ),
  })
);

/* =========================================================
   📝 GRADES
========================================================= */

export const grades = pgTable(
  'grades',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id),

    subject: text('subject').notNull(),
    score: integer('score').notNull(),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    validScore: check('grades_score_check', sql`${t.score} between 0 and 100`),
  })
);

/* =========================================================
   📊 ATTENDANCE
========================================================= */

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id),

    date: timestamp('date').notNull(),
    status: text('status').notNull(), // present, absent, late

    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueEnrollmentDate: unique().on(t.enrollmentId, t.date),
    validStatus: check(
      'attendance_status_check',
      sql`${t.status} in ('present', 'absent', 'late')`
    ),
  })
);

/* =========================================================
   🧾 AUDIT LOGS
========================================================= */

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),

  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  userId: uuid('user_id').references(() => users.id),

  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),

  before: jsonb('before'),
  after: jsonb('after'),

  createdAt: timestamp('created_at').defaultNow(),
});

/* =========================================================
   🚩 FEATURE FLAGS
========================================================= */

export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  defaultValue: boolean('default_value').notNull(),
});

export const institutionFeatureFlags = pgTable(
  'institution_feature_flags',
  {
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    featureKey: text('feature_key').notNull().references(() => featureFlags.key),
    enabled: boolean('enabled').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.institutionId, t.featureKey] }),
  })
);

/* =========================================================
   🧩 EXTENSIONS SYSTEM
========================================================= */

export const extensions = pgTable('extensions', {
  key: text('key').primaryKey(),
  name: text('name'),
  enabled: boolean('enabled').default(true),
});

export const institutionExtensions = pgTable(
  'institution_extensions',
  {
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    extensionKey: text('extension_key').notNull().references(() => extensions.key),
    config: jsonb('config'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.institutionId, t.extensionKey] }),
  })
);

/* =========================================================
   🧱 CUSTOM FIELDS (FLEXIBILITY)
========================================================= */

export const customFields = pgTable('custom_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').references(() => institutions.id),
  entity: text('entity').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
});

export const customFieldValues = pgTable('custom_field_values', {
  id: uuid('id').defaultRandom().primaryKey(),
  fieldId: uuid('field_id').notNull().references(() => customFields.id),
  entityId: uuid('entity_id').notNull(),
  value: jsonb('value'),
});
