import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export const createSubjectBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  code: z.string().trim().max(40).optional(),
  description: z.string().trim().max(500).optional(),
});

export const updateSubjectBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  code: z.string().trim().max(40).optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export const subjectParamsSchema = z.object({
  subjectId: uuidSchema,
});

export const topicParamsSchema = z.object({
  subjectId: uuidSchema,
  topicId: uuidSchema,
});

export const createTopicBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export const updateTopicBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export const classroomSubjectsParamsSchema = z.object({
  classroomId: uuidSchema,
});

export const classroomSubjectParamsSchema = z.object({
  classroomId: uuidSchema,
  subjectId: uuidSchema,
});

export const teacherSubjectsParamsSchema = z.object({
  teacherUserId: uuidSchema,
});

export const teacherSubjectParamsSchema = z.object({
  teacherUserId: uuidSchema,
  subjectId: uuidSchema,
});

export const assignSubjectsBodySchema = z.object({
  subjectIds: z.array(uuidSchema).min(1),
});

export type CreateSubjectBody = z.infer<typeof createSubjectBodySchema>;
export type UpdateSubjectBody = z.infer<typeof updateSubjectBodySchema>;
export type AssignSubjectsBody = z.infer<typeof assignSubjectsBodySchema>;
