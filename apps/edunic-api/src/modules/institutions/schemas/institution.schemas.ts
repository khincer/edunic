import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

const institutionNameSchema = z
  .string()
  .trim()
  .min(1, 'Institution name is required')
  .max(160, 'Institution name must be 160 characters or less');

export const institutionParamsSchema = z.object({
  institutionId: uuidSchema,
});

export const listInstitutionsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createInstitutionBodySchema = z.object({
  name: institutionNameSchema,
});

export const updateInstitutionBodySchema = createInstitutionBodySchema
  .partial()
  .refine((value) => value.name !== undefined, {
    message: 'At least one field must be provided',
  });

export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;
export type CreateInstitutionBody = z.infer<typeof createInstitutionBodySchema>;
export type UpdateInstitutionBody = z.infer<typeof updateInstitutionBodySchema>;
