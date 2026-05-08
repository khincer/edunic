import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

export const customFieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'boolean',
  'select',
]);

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const customFieldParamsSchema = z.object({
  customFieldId: uuidSchema,
});

export const customFieldValuesParamsSchema = z.object({
  entity: z.string().trim().min(1).max(100),
  entityId: uuidSchema,
});

export const listCustomFieldsQuerySchema = z.object({
  entity: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createCustomFieldBodySchema = z.object({
  entity: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1, 'Name is required').max(150),
  type: customFieldTypeSchema,
});

export const updateCustomFieldBodySchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(150).optional(),
    type: customFieldTypeSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.type !== undefined, {
    message: 'At least one field must be provided',
  });

export const upsertCustomFieldValuesBodySchema = z.object({
  values: z
    .array(
      z.object({
        fieldId: uuidSchema,
        value: z.unknown().nullable(),
      })
    )
    .default([]),
});

export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;
export type ListCustomFieldsQuery = z.infer<typeof listCustomFieldsQuerySchema>;
export type CreateCustomFieldBody = z.infer<typeof createCustomFieldBodySchema>;
export type UpdateCustomFieldBody = z.infer<typeof updateCustomFieldBodySchema>;
export type UpsertCustomFieldValuesBody = z.infer<
  typeof upsertCustomFieldValuesBodySchema
>;
