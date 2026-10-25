import { z } from 'zod';

const featureKeySchema = z
  .string()
  .trim()
  .min(1, 'Feature flag key is required')
  .max(100)
  .regex(
    /^[a-z0-9_]+$/,
    'Feature flag key must use lowercase letters, numbers, or underscores'
  );

export const featureFlagParamsSchema = z.object({
  featureKey: featureKeySchema,
});

export const updateFeatureFlagBodySchema = z.object({
  enabled: z.boolean(),
});

export type UpdateFeatureFlagBody = z.infer<typeof updateFeatureFlagBodySchema>;
