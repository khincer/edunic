import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

const sectionSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(20, 'Section must be 20 characters or less').nullable().optional()
);

export const classroomParamsSchema = z.object({
  classroomId: uuidSchema,
});

export const classroomActivityQuerySchema = z.object({
  since: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/,
      'Expected format YYYY-MM-DD or ISO datetime'
    )
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listClassroomsQuerySchema = z.object({
  gradeLevel: z.coerce.number().int().min(1).max(20).optional(),
  section: z.string().trim().max(20).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['gradeLevel', 'section']).default('gradeLevel'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const createClassroomBodySchema = z.object({
  gradeLevel: z.coerce.number().int().min(1).max(20),
  section: sectionSchema,
});

export const updateClassroomBodySchema = z
  .object({
    gradeLevel: z.coerce.number().int().min(1).max(20).optional(),
    section: sectionSchema,
  })
  .refine(
    (value) => value.gradeLevel !== undefined || value.section !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export type ListClassroomsQuery = z.infer<typeof listClassroomsQuerySchema>;
export type CreateClassroomBody = z.infer<typeof createClassroomBodySchema>;
export type UpdateClassroomBody = z.infer<typeof updateClassroomBodySchema>;
export type ClassroomActivityQuery = z.infer<typeof classroomActivityQuerySchema>;
