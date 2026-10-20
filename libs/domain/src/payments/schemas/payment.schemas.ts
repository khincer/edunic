import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export const paymentStatusSchema = z.enum(['pending', 'paid', 'cancelled']);

export const paymentMethodSchema = z.string().trim().min(1).max(40);

export const createPaymentBodySchema = z.object({
  studentId: uuidSchema,
  concept: z.string().trim().min(1, 'Concept is required').max(160),
  amountCents: z.coerce.number().int().positive('Amount must be positive'),
  dueDate: z.string().datetime().optional(),
  method: paymentMethodSchema,
  status: paymentStatusSchema.default('pending'),
  note: z.string().trim().max(500).optional(),
});

export const updatePaymentBodySchema = z.object({
  concept: z.string().trim().min(1).max(160).optional(),
  amountCents: z.coerce.number().int().positive().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  method: paymentMethodSchema.optional(),
  status: paymentStatusSchema.optional(),
  paidAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

export const listPaymentsQuerySchema = z.object({
  studentId: uuidSchema.optional(),
  status: paymentStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const paymentParamsSchema = z.object({
  paymentId: uuidSchema,
});

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
export type UpdatePaymentBody = z.infer<typeof updatePaymentBodySchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
