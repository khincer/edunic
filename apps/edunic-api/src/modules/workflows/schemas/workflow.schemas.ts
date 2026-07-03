import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const listWorkflowQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const assignmentParamsSchema = z.object({
  assignmentId: uuidSchema,
});

export const createAssignmentBodySchema = z.object({
  classroomId: uuidSchema.optional(),
  title: z.string().trim().min(1).max(160),
  type: z.enum(['homework', 'exam', 'assignment']).default('assignment'),
  status: z.enum(['draft', 'published', 'reviewed']).default('published'),
  dueDate: z.string().datetime().optional(),
});

export const updateAssignmentBodySchema = createAssignmentBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const eventParamsSchema = z.object({
  eventId: uuidSchema,
});

export const createEventBodySchema = z.object({
  classroomId: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(160),
  eventType: z.string().trim().min(1).max(60).default('school'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});

export const messageParamsSchema = z.object({
  messageId: uuidSchema,
});

export const createMessageBodySchema = z.object({
  recipientUserId: uuidSchema,
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
});

export type ListWorkflowQuery = z.infer<typeof listWorkflowQuerySchema>;
export type CreateAssignmentBody = z.infer<typeof createAssignmentBodySchema>;
export type UpdateAssignmentBody = z.infer<typeof updateAssignmentBodySchema>;
export type CreateEventBody = z.infer<typeof createEventBodySchema>;
export type CreateMessageBody = z.infer<typeof createMessageBodySchema>;
