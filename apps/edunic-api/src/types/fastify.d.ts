import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { preHandlerHookHandler } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase;
    featureFlags: Record<string, boolean>;
    authenticate: preHandlerHookHandler;
    authorizeRoles: (roles: string[]) => preHandlerHookHandler;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      institutionId: string;
      role: string;
    };
    featureFlags?: Record<string, boolean>;
  }
}

export {};
