import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

const optionalPhoneSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().max(50, 'Phone must be 50 characters or less').nullable().optional()
);

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const guardianParamsSchema = z.object({
  guardianId: uuidSchema,
});

export const studentGuardianParamsSchema = z.object({
  studentId: uuidSchema,
  guardianId: uuidSchema,
});

export const studentGuardiansParamsSchema = z.object({
  studentId: uuidSchema,
});

export const listGuardiansQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'phone']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createGuardianBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less'),
  phone: optionalPhoneSchema,
});

export const updateGuardianBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less').optional(),
    phone: optionalPhoneSchema,
  })
  .refine((value) => value.name !== undefined || value.phone !== undefined, {
    message: 'At least one field must be provided',
  });

export type ListGuardiansQuery = z.infer<typeof listGuardiansQuerySchema>;
export type CreateGuardianBody = z.infer<typeof createGuardianBodySchema>;
export type UpdateGuardianBody = z.infer<typeof updateGuardianBodySchema>;
