import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export { institutionHeaderSchema } from '@edunic/source/domain/shared';

export const studentReportParamsSchema = z.object({
  studentId: uuidSchema,
});

export const studentReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export type StudentReportQuery = z.infer<typeof studentReportQuerySchema>;
