import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export { institutionHeaderSchema } from '@edunic/source/domain/shared';

export const studentAverageParamsSchema = z.object({
  studentId: uuidSchema,
});

export const studentAverageQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export type StudentAverageQuery = z.infer<typeof studentAverageQuerySchema>;
