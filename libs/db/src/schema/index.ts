import {
  sql,
} from 'drizzle-orm';
import {
  check,
  index,
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

export const institutions = pgTable(
  'institutions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    // Per-institution sender identity (design D4). Both nullable: the envelope
    // From: stays the platform-verified EMAIL_FROM_ADDRESS, so a NULL
    // sender_name means "unconfigured" and nothing is sent (SI-R1, SI-R3).
    senderName: text('sender_name'),
    replyToEmail: text('reply_to_email'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    senderNameNotBlank: check(
      'institutions_sender_name_not_blank_check',
      sql`${t.senderName} is null or length(trim(${t.senderName})) > 0`
    ),
    replyToEmailNotBlank: check(
      'institutions_reply_to_email_not_blank_check',
      sql`${t.replyToEmail} is null or length(trim(${t.replyToEmail})) > 0`
    ),
  })
);

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

// Single-school model: one role per user, no institution dimension. Replaces
// `user_institution_roles` once the auth contract drops the institution.
// The unique constraint is the ROLE-05 guarantee: a user holds exactly one
// role, so the same person cannot be an admin in one school and a teacher in
// another.
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueUserRole: unique().on(t.userId),
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

export const guardians = pgTable(
  'guardians',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    name: text('name').notNull(),
    phone: text('phone'),
    // Guardian contact address (GE-R1). NULL and '' both mean "no email"; the
    // CHECK keeps a blank string from masquerading as a contact.
    email: text('email'),
  },
  (t) => ({
    emailNotBlank: check(
      'guardians_email_not_blank_check',
      sql`${t.email} is null or length(trim(${t.email})) > 0`
    ),
  })
);

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

export const guardianUserLinks = pgTable(
  'guardian_user_links',
  {
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    guardianId: uuid('guardian_id').notNull().references(() => guardians.id),
    userId: uuid('user_id').notNull().references(() => users.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.institutionId, t.guardianId, t.userId] }),
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
    createdAt: timestamp('created_at').defaultNow(),
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

export const teacherClassroomAssignments = pgTable(
  'teacher_classroom_assignments',
  {
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    teacherUserId: uuid('teacher_user_id').notNull().references(() => users.id),
    classroomId: uuid('classroom_id').notNull().references(() => classrooms.id),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.institutionId, t.teacherUserId, t.classroomId],
    }),
  })
);

/* =========================================================
   📚 SUBJECTS & TOPICS (single-school)
   ========================================================= */

// A "materia" (Math, History) and the "temas" it contains (sums, fractions,
// revolutions). Both are first-class: grades and assignments point at a
// materia and optionally at one of its temas.
export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    code: text('code'),
    description: text('description'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueSubjectName: unique().on(t.name),
  })
);

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueTopicName: unique().on(t.subjectId, t.name),
  })
);

// Which materias a grade level (classroom) offers.
export const classroomSubjects = pgTable(
  'classroom_subjects',
  {
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.classroomId, t.subjectId],
    }),
  })
);

// Which materias a teacher is responsible for.
export const subjectTeachers = pgTable(
  'subject_teachers',
  {
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    teacherUserId: uuid('teacher_user_id')
      .notNull()
      .references(() => users.id),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.subjectId, t.teacherUserId],
    }),
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

    // A grade points at a materia and optionally at one of its temas.
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    topicId: uuid('topic_id').references(() => topics.id),
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

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),

  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),

  eventName: text('event_name').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  readAt: timestamp('read_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  classroomId: uuid('classroom_id').references(() => classrooms.id),
  // An assignment targets a materia and optionally one of its temas.
  subjectId: uuid('subject_id').references(() => subjects.id),
  topicId: uuid('topic_id').references(() => topics.id),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  title: text('title').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull().default('draft'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schoolEvents = pgTable('school_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  classroomId: uuid('classroom_id').references(() => classrooms.id),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  title: text('title').notNull(),
  eventType: text('event_type').notNull().default('school'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messageThreads = pgTable('message_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  subject: text('subject').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  threadId: uuid('thread_id').notNull().references(() => messageThreads.id),
  senderUserId: uuid('sender_user_id').references(() => users.id),
  recipientUserId: uuid('recipient_user_id').references(() => users.id),
  body: text('body').notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reportHistory = pgTable('report_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  studentId: uuid('student_id').notNull().references(() => students.id),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull().default('academic_summary'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

/* =========================================================
   🚩 FEATURE FLAGS
========================================================= */

/* =========================================================
   OFFLINE PAYMENTS (single-school)
   ========================================================= */

// The offline payment ledger: one row per billed concept for a student.
// `status` and `paid_at` are kept consistent by a check constraint, so a
// payment is either unpaid with no date, or paid with one.
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    concept: text('concept').notNull(),
    amountCents: integer('amount_cents').notNull(),
    dueDate: timestamp('due_date'),
    paidAt: timestamp('paid_at'),
    method: text('method').notNull(),
    status: text('status').notNull().default('pending'),
    receiptNumber: text('receipt_number').notNull(),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    uniqueReceiptNumber: unique().on(t.receiptNumber),
    positiveAmount: check('payments_amount_cents_check', sql`${t.amountCents} > 0`),
    validStatus: check(
      'payments_status_check',
      sql`${t.status} in ('pending', 'paid', 'cancelled')`
    ),
    paidMatchesDate: check(
      'payments_paid_at_check',
      sql`(${t.status} = 'paid') = (${t.paidAt} is not null)`
    ),
  })
);

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
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  entity: text('entity').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
});

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fieldId: uuid('field_id').notNull().references(() => customFields.id),
    entityId: uuid('entity_id').notNull(),
    value: jsonb('value'),
  },
  (t) => ({
    uniqueFieldEntity: unique().on(t.fieldId, t.entityId),
  })
);

/* =========================================================
   📬 TRANSACTIONAL OUTBOX (design D2)
   ========================================================= */

// One row per domain event, written inside the same transaction as the
// domain row it describes; `id` is the event envelope id so delivery is
// identifiable end-to-end. `published_at IS NULL` means the background
// outbox publisher still owes a delivery.
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey(),
  event: jsonb('event').notNull(),
  occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
});

/* =========================================================
   ✉️ EMAIL DELIVERY LEDGER (design D4)
   ========================================================= */

// One row per (institution, event, recipient address) delivery attempt. The
// unique key is the database half of the once-only guarantee: the enqueue
// inserts `on conflict do nothing`, so a redelivered event cannot add a second
// record for the same address. `event_id` is the envelope id and has no FK to
// `outbox_events`, so the ledger is independent of outbox retention.
export const emailDeliveries = pgTable(
  'email_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id),
    eventId: uuid('event_id').notNull(),
    eventName: text('event_name').notNull(),
    // Trimmed and lowercased on write; the same normalization the queue's
    // deterministic jobId hashes (D2).
    recipientAddress: text('recipient_address').notNull(),
    recipientSource: text('recipient_source').notNull(),
    studentId: uuid('student_id'),
    // DR-R1's four statuses plus `sending`, the transient in-flight claim.
    status: text('status').notNull().default('queued'),
    attemptCount: integer('attempt_count').notNull().default(0),
    providerMessageId: text('provider_message_id'),
    providerError: text('provider_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    sentAt: timestamp('sent_at'),
  },
  (t) => ({
    uniqueEventRecipient: unique(
      'email_deliveries_event_id_recipient_address_unique'
    ).on(t.eventId, t.recipientAddress),
    validRecipientSource: check(
      'email_deliveries_recipient_source_check',
      sql`${t.recipientSource} in ('guardian', 'user')`
    ),
    validStatus: check(
      'email_deliveries_status_check',
      sql`${t.status} in ('queued', 'sending', 'sent', 'failed', 'retried')`
    ),
    institutionCreatedIdx: index(
      'email_deliveries_institution_created_idx'
    ).on(t.institutionId, t.createdAt.desc(), t.id.desc()),
    inflightIdx: index('email_deliveries_inflight_idx')
      .on(t.institutionId)
      .where(sql`${t.status} in ('queued', 'sending', 'retried')`),
  })
);
