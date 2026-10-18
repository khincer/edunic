import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

const optionalPhoneSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().max(50, 'Phone must be 50 characters or less').nullable().optional()
);

// GE-R1: NULL and '' both mean "no email"; a blank string is normalised to NULL
// so it cannot masquerade as a contact (the column CHECK rejects '' as well).
const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .email('Email must be a valid email address')
    .max(255, 'Email must be 255 characters or less')
    .nullable()
    .optional()
);

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
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'phone', 'email']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createGuardianBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less'),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
});

export const updateGuardianBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(150, 'Name must be 150 characters or less').optional(),
    phone: optionalPhoneSchema,
    email: optionalEmailSchema,
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.phone !== undefined ||
      value.email !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export type ListGuardiansQuery = z.infer<typeof listGuardiansQuerySchema>;
export type CreateGuardianBody = z.infer<typeof createGuardianBodySchema>;
export type UpdateGuardianBody = z.infer<typeof updateGuardianBodySchema>;
