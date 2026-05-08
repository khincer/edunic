import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  institutionId: uuidSchema,
});

export type LoginBody = z.infer<typeof loginBodySchema>;
