import type {
  FastifyPluginAsync,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';
import { AuthRepository } from '../modules/auth/infrastructure/auth.repository.js';
import { verifyJwt } from '../modules/auth/application/jwt.js';

const authPluginHandler: FastifyPluginAsync = async (app) => {
  const authRepository = new AuthRepository(app.db);

  app.decorate(
    'authenticate',
    (async (request: FastifyRequest) => {
      const authorizationHeader = request.headers.authorization;

      if (!authorizationHeader?.startsWith('Bearer ')) {
        throw new ErrorWithStatus('Authentication is required', 401);
      }

      const token = authorizationHeader.slice('Bearer '.length).trim();

      if (!token) {
        throw new ErrorWithStatus('Authentication is required', 401);
      }

      let payload;

      try {
        payload = verifyJwt(token, env.JWT_SECRET);
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'Token expired'
            ? 'Token expired'
            : 'Invalid token';
        throw new ErrorWithStatus(message, 401);
      }

      const userRole = await authRepository.findUserRole(
        payload.sub,
        payload.institutionId
      );

      if (!userRole) {
        throw new ErrorWithStatus(
          'User role for this institution was not found',
          403
        );
      }

      if (
        typeof request.headers['x-institution-id'] === 'string' &&
        request.headers['x-institution-id'] !== userRole.institutionId
      ) {
        throw new ErrorWithStatus(
          'Authenticated institution does not match x-institution-id',
          403
        );
      }

      request.user = {
        id: payload.sub,
        institutionId: userRole.institutionId,
        role: userRole.role,
      };
    }) satisfies preHandlerHookHandler
  );

  app.decorate('authorizeRoles', (roles: string[]) => {
    const handler: preHandlerHookHandler = async (request: FastifyRequest) => {
      if (!request.user) {
        throw new ErrorWithStatus('Authentication is required', 401);
      }

      if (!roles.includes(request.user.role)) {
        throw new ErrorWithStatus('You do not have permission to perform this action', 403);
      }
    };

    return handler;
  });
};

class ErrorWithStatus extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

export const authPlugin = fp(authPluginHandler, {
  name: 'auth-plugin',
  dependencies: ['db-plugin'],
});
