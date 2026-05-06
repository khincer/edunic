import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  AuditLogsService,
  AuditLogsServiceError,
} from '../modules/audit-logs/application/audit-logs.service.js';
import { AuditLogsRepository } from '../modules/audit-logs/infrastructure/audit-logs.repository.js';
import {
  institutionHeaderSchema,
  listAuditLogsQuerySchema,
} from '../modules/audit-logs/schemas/audit-log.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new AuditLogsServiceError(
        firstIssue?.message ?? 'Invalid request',
        400
      );
    }

    throw error;
  }
}

function getInstitutionId(request: FastifyRequest) {
  const headers = parseWithSchema(institutionHeaderSchema, request.headers);
  return headers['x-institution-id'];
}

export async function auditLogRoutes(app: FastifyInstance) {
  const auditLogsService = new AuditLogsService(new AuditLogsRepository(app.db));
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/audit-logs', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listAuditLogsQuerySchema, request.query);

    return auditLogsService.listAuditLogs({
      institutionId,
      ...query,
    });
  });
}
