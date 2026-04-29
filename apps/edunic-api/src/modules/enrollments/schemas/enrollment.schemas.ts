import { z } from 'zod';

const uuidSchema = z.string().uuid();

const enrollmentStatusSchema = z.enum(['active', 'withdrawn', 'completed']);

const optionalClassroomIdSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  uuidSchema.nullable().optional()
);

const optionalPromotionStatusSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().max(100, 'Promotion status must be 100 characters or less').nullable().optional()
);

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const enrollmentParamsSchema = z.object({
  enrollmentId: uuidSchema,
});

export const listEnrollmentsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  studentId: uuidSchema.optional(),
  academicPeriodId: uuidSchema.optional(),
  status: enrollmentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z
    .enum(['createdAt', 'status', 'studentName'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createEnrollmentBodySchema = z.object({
  studentId: uuidSchema,
  academicPeriodId: uuidSchema,
  classroomId: optionalClassroomIdSchema,
  status: enrollmentStatusSchema.default('active'),
  promotionStatus: optionalPromotionStatusSchema,
});

export const updateEnrollmentBodySchema = z
  .object({
    classroomId: uuidSchema.nullable().optional(),
    status: enrollmentStatusSchema.optional(),
    promotionStatus: optionalPromotionStatusSchema,
  })
  .refine(
    (value) =>
      value.classroomId !== undefined ||
      value.status !== undefined ||
      value.promotionStatus !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;
export type ListEnrollmentsQuery = z.infer<typeof listEnrollmentsQuerySchema>;
export type CreateEnrollmentBody = z.infer<typeof createEnrollmentBodySchema>;
export type UpdateEnrollmentBody = z.infer<typeof updateEnrollmentBodySchema>;
