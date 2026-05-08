import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const studentAverageParamsSchema = z.object({
  studentId: uuidSchema,
});

export const studentAverageQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export type StudentAverageQuery = z.infer<typeof studentAverageQuerySchema>;
