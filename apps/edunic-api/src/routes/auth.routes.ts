import type { FastifyInstance } from 'fastify';
import {
  AuthService,
  AuthServiceError,
} from '../modules/auth/application/auth.service.js';
import { LoginRateLimiter } from '../modules/auth/application/login-rate-limiter.js';
import { AuthRepository } from '../modules/auth/infrastructure/auth.repository.js';
import { loginBodySchema } from '../modules/auth/schemas/auth.schemas.js';
import { parseWithSchema } from '@edunic/source/domain/shared';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(new AuthRepository(app.db));
  const loginRateLimiter = new LoginRateLimiter();

  app.post('/login', async (request) => {
    const body = parseWithSchema(loginBodySchema, request.body);

    loginRateLimiter.assertAllowed(request.ip, body.email);

    try {
      const result = await authService.login(body);
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
