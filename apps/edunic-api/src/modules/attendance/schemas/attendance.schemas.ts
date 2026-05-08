import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

const attendanceStatusSchema = z.enum(['present', 'absent', 'late']);

const attendanceDateSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/,
    'Expected format YYYY-MM-DD or ISO datetime'
  );

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const attendanceParamsSchema = z.object({
  attendanceId: uuidSchema,
});

export const listAttendanceQuerySchema = z.object({
  enrollmentId: uuidSchema.optional(),
  status: attendanceStatusSchema.optional(),
  date: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'date', 'status']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createAttendanceBodySchema = z.object({
  enrollmentId: uuidSchema,
  date: attendanceDateSchema,
  status: attendanceStatusSchema,
});

export const updateAttendanceBodySchema = z
  .object({
    date: attendanceDateSchema.optional(),
    status: attendanceStatusSchema.optional(),
  })
  .refine((value) => value.date !== undefined || value.status !== undefined, {
    message: 'At least one field must be provided',
  });

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type CreateAttendanceBody = z.infer<typeof createAttendanceBodySchema>;
export type UpdateAttendanceBody = z.infer<typeof updateAttendanceBodySchema>;
