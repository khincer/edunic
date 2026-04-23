import { z } from 'zod';

const uuidSchema = z.string().uuid();

const studentNameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(120, 'Must be 120 characters or less');

const optionalDateOfBirthSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected format YYYY-MM-DD')
    .optional()
);

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const studentParamsSchema = z.object({
  studentId: uuidSchema,
});

export const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createStudentBodySchema = z.object({
  firstName: studentNameSchema,
  lastName: studentNameSchema,
  dateOfBirth: optionalDateOfBirthSchema,
});

export const updateStudentBodySchema = createStudentBodySchema
  .partial()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.dateOfBirth !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type CreateStudentBody = z.infer<typeof createStudentBodySchema>;
export type UpdateStudentBody = z.infer<typeof updateStudentBodySchema>;
