import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { parseWithSchema } from './parse-with-schema.js';
import { uuidSchema } from './uuid.schema.js';

export const institutionHeaderSchema = z.object({
  'x-institution-id': uuidSchema,
});

export function getInstitutionId(request: FastifyRequest): string {
  const headers = parseWithSchema(institutionHeaderSchema, request.headers);
  return headers['x-institution-id'];
}
