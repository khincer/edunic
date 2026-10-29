import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const studentNameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(120, 'Must be 120 characters or less');

// The second name is optional: '' and null both mean "none".
const optionalSecondNameSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  studentNameSchema.nullable().optional()
);

const optionalDateOfBirthSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .trim()
    .regex(DATE_PATTERN, 'Expected format YYYY-MM-DD')
    .optional()
);

// A real calendar day (2015-02-30 is rejected) that is not in the future.
const requiredDateOfBirthSchema = z
  .string({ error: 'Date of birth is required' })
  .trim()
  .regex(DATE_PATTERN, 'Expected format YYYY-MM-DD')
  .refine(isCalendarDay, 'Date of birth is not a valid date')
  .refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    'Date of birth cannot be in the future'
  );

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(50, 'Phone must be 50 characters or less').nullable().optional()
);

const registrationGuardianSchema = z.object({
  name: z
    .string({ error: 'Guardian name is required' })
    .trim()
    .min(1, 'Guardian name is required')
    .max(150, 'Name must be 150 characters or less'),
  email: z
    .string({ error: 'Guardian email is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Guardian email is required')
    .email('Email must be a valid email address')
    .max(255, 'Email must be 255 characters or less'),
  phone: optionalPhoneSchema,
});

export const studentParamsSchema = z.object({
  studentId: uuidSchema,
});

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z
    .enum(['createdAt', 'firstName', 'firstLastName', 'secondLastName'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createStudentBodySchema = z.object({
  firstName: studentNameSchema,
  secondName: optionalSecondNameSchema,
  firstLastName: studentNameSchema,
  secondLastName: studentNameSchema,
  dateOfBirth: optionalDateOfBirthSchema,
});

export const updateStudentBodySchema = createStudentBodySchema
  .partial()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.secondName !== undefined ||
      value.firstLastName !== undefined ||
      value.secondLastName !== undefined ||
      value.dateOfBirth !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export const registerStudentBodySchema = z
  .object({
    firstName: studentNameSchema,
    secondName: optionalSecondNameSchema,
    firstLastName: studentNameSchema,
    secondLastName: studentNameSchema,
    dateOfBirth: requiredDateOfBirthSchema,
    classroomId: uuidSchema,
    guardians: z
      .array(registrationGuardianSchema)
      .min(1, 'At least one guardian is required')
      .max(2, 'At most two guardians are allowed'),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.guardians.forEach((guardian, index) => {
      if (seen.has(guardian.email)) {
        context.addIssue({
          code: 'custom',
          path: ['guardians', index, 'email'],
          message: 'Each guardian needs a different email',
        });
      }

      seen.add(guardian.email);
    });
  });

function isCalendarDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type CreateStudentBody = z.infer<typeof createStudentBodySchema>;
export type UpdateStudentBody = z.infer<typeof updateStudentBodySchema>;
export type RegisterStudentBody = z.infer<typeof registerStudentBodySchema>;
