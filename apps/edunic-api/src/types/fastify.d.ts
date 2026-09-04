import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { preHandlerHookHandler } from 'fastify';
import type { EventBus } from '@edunic/source/events';
import type { AuditLogsRepository } from '@edunic/source/domain/audit-logs';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase;
    featureFlags: Record<string, boolean>;
    authenticate: preHandlerHookHandler;
    authorizeRoles: (roles: string[]) => preHandlerHookHandler;
    auditLogs: AuditLogsRepository;
    eventBus: EventBus;
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
