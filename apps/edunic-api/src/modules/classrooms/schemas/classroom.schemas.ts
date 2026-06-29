import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

const sectionSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().trim().max(20, 'Section must be 20 characters or less').nullable().optional()
);

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const classroomParamsSchema = z.object({
  classroomId: uuidSchema,
});

export const listClassroomsQuerySchema = z.object({
  gradeLevel: z.coerce.number().int().min(1).max(20).optional(),
  section: z.string().trim().max(20).optional(),
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
