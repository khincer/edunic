import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import {
  AuthService,
  AuthServiceError,
  LoginRateLimiter,
  AuthRepository,
  loginBodySchema,
} from '@edunic/source/domain/auth';
import { parseWithSchema } from '@edunic/source/domain/shared';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(new AuthRepository(app.db));
  const loginRateLimiter = new LoginRateLimiter();

  app.post('/login', async (request) => {
    const body = parseWithSchema(loginBodySchema, request.body);

    loginRateLimiter.assertAllowed(request.ip, body.email);

    try {
      const result = await authService.login(body, env.JWT_SECRET);
      loginRateLimiter.reset(request.ip, body.email);
      return result;
    } catch (error) {
      if (error instanceof AuthServiceError && error.statusCode === 401) {
        loginRateLimiter.recordFailure(request.ip, body.email);
      }

      throw error;
    }
  });
}
