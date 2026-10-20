import type {
  FastifyPluginAsync,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';
import { AuthRepository, verifyJwt } from '@edunic/source/domain/auth';

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
        payload = await verifyJwt(token, env.JWT_SECRET);
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'Token expired'
            ? 'Token expired'
            : 'Invalid token';
        throw new ErrorWithStatus(message, 401);
      }

      const authContext = await authRepository.findAuthContext(payload.sub);

      if (!authContext) {
        throw new ErrorWithStatus('User role was not found', 403);
      }

      request.user = {
        id: payload.sub,
        institutionId: authContext.institutionId,
        role: authContext.role,
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
