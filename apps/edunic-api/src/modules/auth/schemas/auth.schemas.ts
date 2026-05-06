import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  institutionId: z.string().uuid(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
