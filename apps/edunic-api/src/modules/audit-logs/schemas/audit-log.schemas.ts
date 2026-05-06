import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const listAuditLogsQuerySchema = z.object({
  entity: z.string().trim().max(100).optional(),
  action: z.enum(['create', 'update', 'delete']).optional(),
  userId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
