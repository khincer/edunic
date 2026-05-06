import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  AuthService,
  AuthServiceError,
} from '../modules/auth/application/auth.service.js';
import { AuthRepository } from '../modules/auth/infrastructure/auth.repository.js';
import { loginBodySchema } from '../modules/auth/schemas/auth.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new AuthServiceError(firstIssue?.message ?? 'Invalid request', 400);
    }

    throw error;
  }
}

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(new AuthRepository(app.db));

  app.post('/login', async (request) => {
    const body = parseWithSchema(loginBodySchema, request.body);

    return authService.login(body);
  });
}
