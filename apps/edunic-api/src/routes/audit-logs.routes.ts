import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  AuditLogsService,
  AuditLogsServiceError,
  AuditLogsRepository,
  institutionHeaderSchema,
  listAuditLogsQuerySchema,
} from '@edunic/source/domain/audit-logs';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';

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
