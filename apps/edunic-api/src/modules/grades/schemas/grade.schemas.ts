import { z } from 'zod';

const uuidSchema = z.string().uuid();

const scoreSchema = z
  .number()
  .int('Score must be an integer')
  .min(0, 'Score must be at least 0')
  .max(100, 'Score must be 100 or less');

const subjectSchema = z
  .string()
  .trim()
  .min(1, 'Subject is required')
  .max(120, 'Subject must be 120 characters or less');

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const gradeParamsSchema = z.object({
  gradeId: uuidSchema,
});

export const listGradesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  enrollmentId: uuidSchema.optional(),
  subject: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'subject', 'score']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createGradeBodySchema = z.object({
  enrollmentId: uuidSchema,
  subject: subjectSchema,
  score: z.coerce.number().pipe(scoreSchema),
});

export const updateGradeBodySchema = z
  .object({
    subject: subjectSchema.optional(),
    score: z.coerce.number().pipe(scoreSchema).optional(),
  })
  .refine(
    (value) => value.subject !== undefined || value.score !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export type ListGradesQuery = z.infer<typeof listGradesQuerySchema>;
export type CreateGradeBody = z.infer<typeof createGradeBodySchema>;
export type UpdateGradeBody = z.infer<typeof updateGradeBodySchema>;
