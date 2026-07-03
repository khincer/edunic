import { z } from 'zod';
import { uuidSchema } from '../../shared/uuid.schema.js';

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export type InstitutionHeader = z.infer<typeof institutionHeaderSchema>;
