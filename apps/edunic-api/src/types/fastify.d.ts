import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { preHandlerHookHandler } from 'fastify';
import type { AuditLogsRepository } from '../modules/audit-logs/infrastructure/audit-logs.repository.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase;
    featureFlags: Record<string, boolean>;
    authenticate: preHandlerHookHandler;
    authorizeRoles: (roles: string[]) => preHandlerHookHandler;
    auditLogs: AuditLogsRepository;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      institutionId: string;
      role: string;
    };
    featureFlags?: Record<string, boolean>;
    auditPayload?: unknown;
  }
}

export {};
