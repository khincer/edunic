import {
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
    userId: uuid('user_id').notNull(),
    institutionId: uuid('institution_id').notNull(),
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
  institutionId: uuid('institution_id').notNull(),

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
  institutionId: uuid('institution_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
});

export const studentGuardians = pgTable(
  'student_guardians',
  {
    studentId: uuid('student_id').notNull(),
    guardianId: uuid('guardian_id').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.guardianId] }),
  })
);

/* =========================================================
   📅 ACADEMIC STRUCTURE
========================================================= */

export const academicPeriods = pgTable('academic_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull(),
  year: integer('year').notNull(),
  term: integer('term').notNull(), // 1–4
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
});

export const classrooms = pgTable('classrooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull(),
  gradeLevel: integer('grade_level').notNull(),
  section: text('section'),
});

/* =========================================================
   📚 ENROLLMENTS
========================================================= */

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    institutionId: uuid('institution_id').notNull(),
    studentId: uuid('student_id').notNull(),
    academicPeriodId: uuid('academic_period_id').notNull(),
    classroomId: uuid('classroom_id'),

    status: text('status').default('active'),
    promotionStatus: text('promotion_status'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueStudentPeriod: unique().on(
      t.studentId,
      t.academicPeriodId
    ),
  })
);

/* =========================================================
   📝 GRADES
========================================================= */

export const grades = pgTable('grades', {
  id: uuid('id').defaultRandom().primaryKey(),

  institutionId: uuid('institution_id').notNull(),
  enrollmentId: uuid('enrollment_id').notNull(),

  subject: text('subject').notNull(),
  score: integer('score').notNull(),

  createdAt: timestamp('created_at').defaultNow(),
});

/* =========================================================
   📊 ATTENDANCE
========================================================= */

export const attendance = pgTable('attendance', {
  id: uuid('id').defaultRandom().primaryKey(),

  institutionId: uuid('institution_id').notNull(),
  enrollmentId: uuid('enrollment_id').notNull(),

  date: timestamp('date').notNull(),
  status: text('status').notNull(), // present, absent, late

  createdAt: timestamp('created_at').defaultNow(),
});

/* =========================================================
   🧾 AUDIT LOGS
========================================================= */

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),

  institutionId: uuid('institution_id').notNull(),
  userId: uuid('user_id'),

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
    institutionId: uuid('institution_id').notNull(),
    featureKey: text('feature_key').notNull(),
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
    institutionId: uuid('institution_id').notNull(),
    extensionKey: text('extension_key').notNull(),
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
  institutionId: uuid('institution_id'),
  entity: text('entity').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
});

export const customFieldValues = pgTable('custom_field_values', {
  id: uuid('id').defaultRandom().primaryKey(),
  fieldId: uuid('field_id').notNull(),
  entityId: uuid('entity_id').notNull(),
  value: jsonb('value'),
});
