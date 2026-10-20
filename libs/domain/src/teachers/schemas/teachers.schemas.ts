import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export const teacherRoleSchema = z.enum(['admin', 'teacher', 'parent']);

export const listTeachersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const createTeacherBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: teacherRoleSchema.default('teacher'),
  classroomIds: z.array(uuidSchema).optional(),
});

export const teacherParamsSchema = z.object({
  userId: uuidSchema,
});

export const teacherClassroomParamsSchema = z.object({
  userId: uuidSchema,
  classroomId: uuidSchema,
});

export const updateTeacherRoleBodySchema = z.object({
  role: teacherRoleSchema,
});

export const assignClassroomsBodySchema = z.object({
  classroomIds: z.array(uuidSchema).min(1),
});

export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
export type CreateTeacherBody = z.infer<typeof createTeacherBodySchema>;
export type UpdateTeacherRoleBody = z.infer<typeof updateTeacherRoleBodySchema>;
export type AssignClassroomsBody = z.infer<typeof assignClassroomsBodySchema>;
