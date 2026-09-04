import { z } from 'zod';
import { uuidSchema } from '@edunic/source/domain/shared';

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export type InstitutionHeader = z.infer<typeof institutionHeaderSchema>;
