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

export type CreateInstitutionBody = z.infer<typeof createInstitutionBodySchema>;
export type UpdateInstitutionBody = z.infer<typeof updateInstitutionBodySchema>;
