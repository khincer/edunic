import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export const studentReportParamsSchema = z.object({
  studentId: uuidSchema,
});

export const studentReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export type StudentReportQuery = z.infer<typeof studentReportQuerySchema>;

export const listReportHistoryQuerySchema = z.object({
  studentId: uuidSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListReportHistoryQuery = z.infer<typeof listReportHistoryQuerySchema>;
