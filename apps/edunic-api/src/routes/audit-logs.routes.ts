import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  AuditLogsService,
  AuditLogsServiceError,
  AuditLogsRepository,
  listAuditLogsQuerySchema,
} from '@edunic/source/domain/audit-logs';
import {
  parseWithSchema,
  getInstitutionId,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

const AUDIT_LOG_FILTER_SORT_OPTIONS = {
  filterFields: ['entity', 'action', 'userId', 'entityId', 'createdAt'],
  sortFields: ['entity', 'action', 'userId', 'entityId', 'createdAt'],
};

export async function auditLogRoutes(app: FastifyInstance) {
  const auditLogsService = new AuditLogsService(new AuditLogsRepository(app.db));
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  app.get('/audit-logs', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listAuditLogsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      AUDIT_LOG_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return auditLogsService.listAuditLogs({
      institutionId,
      ...query,
      filters,
      sort,
    });
  });
}
