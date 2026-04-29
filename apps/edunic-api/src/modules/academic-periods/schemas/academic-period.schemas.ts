import { z } from 'zod';

const uuidSchema = z.string().uuid();

const dateStringSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/,
    'Expected format YYYY-MM-DD or ISO datetime'
  );

const optionalDateStringSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  dateStringSchema.optional()
);

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const academicPeriodParamsSchema = z.object({
  academicPeriodId: uuidSchema,
});

export const listAcademicPeriodsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  term: z.coerce.number().int().min(1).max(4).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'year', 'term', 'startDate']).default('year'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createAcademicPeriodBodySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100),
    term: z.coerce.number().int().min(1).max(4),
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      new Date(value.startDate).getTime() <= new Date(value.endDate).getTime(),
    {
      message: 'Start date must be before or equal to end date',
      path: ['endDate'],
    }
  );

export const updateAcademicPeriodBodySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    term: z.coerce.number().int().min(1).max(4).optional(),
    startDate: z.union([dateStringSchema, z.null()]).optional(),
    endDate: z.union([dateStringSchema, z.null()]).optional(),
  })
  .refine(
    (value) =>
      value.year !== undefined ||
      value.term !== undefined ||
      value.startDate !== undefined ||
      value.endDate !== undefined,
    {
      message: 'At least one field must be provided',
    }
  )
  .refine(
    (value) => {
      if (value.startDate === undefined || value.endDate === undefined) {
        return true;
      }

      if (value.startDate === null || value.endDate === null) {
        return true;
      }

      return new Date(value.startDate).getTime() <= new Date(value.endDate).getTime();
    },
    {
      message: 'Start date must be before or equal to end date',
      path: ['endDate'],
    }
  );

export type ListAcademicPeriodsQuery = z.infer<
  typeof listAcademicPeriodsQuerySchema
>;
export type CreateAcademicPeriodBody = z.infer<
  typeof createAcademicPeriodBodySchema
>;
export type UpdateAcademicPeriodBody = z.infer<
  typeof updateAcademicPeriodBodySchema
>;
