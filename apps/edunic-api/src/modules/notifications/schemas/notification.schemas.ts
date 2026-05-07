import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export const notificationParamsSchema = z.object({
  notificationId: uuidSchema,
});

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  eventName: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
