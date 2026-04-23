import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase;
    featureFlags: any;
    authenticate: any;
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
