import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

const featureKeySchema = z
  .string()
  .trim()
  .min(1, 'Feature flag key is required')
  .max(100)
  .regex(
    /^[a-z0-9_]+$/,
    'Feature flag key must use lowercase letters, numbers, or underscores'
  );

export const institutionFeatureFlagsParamsSchema = z.object({
  institutionId: uuidSchema,
});

export const institutionFeatureFlagParamsSchema = z.object({
  institutionId: uuidSchema,
  featureKey: featureKeySchema,
});

export const updateInstitutionFeatureFlagBodySchema = z.object({
  enabled: z.boolean(),
});

export type UpdateInstitutionFeatureFlagBody = z.infer<
  typeof updateInstitutionFeatureFlagBodySchema
>;
