import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const studentReportParamsSchema = z.object({
  studentId: uuidSchema,
});

export const studentReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export type StudentReportQuery = z.infer<typeof studentReportQuerySchema>;
