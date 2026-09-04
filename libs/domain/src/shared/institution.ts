import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { parseWithSchema } from './parse-with-schema.js';

export const institutionHeaderSchema = z.object({
  'x-institution-id': z.string().uuid('Invalid institution ID'),
});

export function getInstitutionId(request: FastifyRequest): string {
  const headers = parseWithSchema(institutionHeaderSchema, request.headers);
  return headers['x-institution-id'];
}
