import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

const institutionNameSchema = z
  .string()
  .trim()
  .min(1, 'Institution name is required')
  .max(160, 'Institution name must be 160 characters or less');

// SI-R1/SI-R2: the identity is per institution and blank input clears it to
// NULL, matching the column CHECK that rejects a blank string.
const optionalSenderNameSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .max(160, 'Sender name must be 160 characters or less')
    .nullable()
    .optional()
);

const optionalReplyToEmailSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .email('Reply-to email must be a valid email address')
    .max(255, 'Reply-to email must be 255 characters or less')
    .nullable()
    .optional()
);

export const institutionParamsSchema = z.object({
  institutionId: uuidSchema,
});

export const listInstitutionsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createInstitutionBodySchema = z.object({
  name: institutionNameSchema,
});

export const updateInstitutionBodySchema = z
  .object({
    name: institutionNameSchema.optional(),
    senderName: optionalSenderNameSchema,
    replyToEmail: optionalReplyToEmailSchema,
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.senderName !== undefined ||
      value.replyToEmail !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;
export type CreateInstitutionBody = z.infer<typeof createInstitutionBodySchema>;
export type UpdateInstitutionBody = z.infer<typeof updateInstitutionBodySchema>;
