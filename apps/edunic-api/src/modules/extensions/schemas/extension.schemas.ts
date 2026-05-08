import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';
const extensionKeySchema = z
  .string()
  .trim()
  .min(1, 'Extension key is required')
  .max(100)
  .regex(/^[a-z0-9_-]+$/, 'Extension key must use lowercase letters, numbers, underscores, or hyphens');

const configSchema = z
  .record(z.string(), z.unknown())
  .default({});

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const extensionParamsSchema = z.object({
  extensionKey: extensionKeySchema,
});

export const institutionExtensionParamsSchema = z.object({
  institutionId: uuidSchema,
  extensionKey: extensionKeySchema,
});

export const institutionExtensionsParamsSchema = z.object({
  institutionId: uuidSchema,
});

export const listExtensionsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  enabled: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createExtensionBodySchema = z.object({
  key: extensionKeySchema,
  name: z.string().trim().min(1, 'Name is required').max(150),
  enabled: z.boolean().default(true),
});

export const updateExtensionBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(150).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.enabled !== undefined, {
    message: 'At least one field must be provided',
  });

export const upsertInstitutionExtensionBodySchema = z.object({
  config: configSchema,
});

export type ListExtensionsQuery = z.infer<typeof listExtensionsQuerySchema>;
export type CreateExtensionBody = z.infer<typeof createExtensionBodySchema>;
export type UpdateExtensionBody = z.infer<typeof updateExtensionBodySchema>;
export type UpsertInstitutionExtensionBody = z.infer<
  typeof upsertInstitutionExtensionBodySchema
>;
