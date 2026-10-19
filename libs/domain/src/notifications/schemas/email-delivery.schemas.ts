import { z } from 'zod';

// Mirrors the `email_deliveries_status_check` constraint from migration 0008
// (design D4): the four delivery states plus `sending`, the transient in-flight
// claim the delivery job takes before it sends.
export const emailDeliveryStatusSchema = z.enum([
  'queued',
  'sending',
  'sent',
  'failed',
  'retried',
]);

export type EmailDeliveryStatus = z.infer<typeof emailDeliveryStatusSchema>;

export const listEmailDeliveriesQuerySchema = z.object({
  status: emailDeliveryStatusSchema.optional(),
  eventName: z.string().trim().max(100).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListEmailDeliveriesQuery = z.infer<
  typeof listEmailDeliveriesQuerySchema
>;
