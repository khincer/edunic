import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { AuditLogsRepository } from '../modules/audit-logs/infrastructure/audit-logs.repository.js';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

const auditLogsPluginHandler: FastifyPluginAsync = async (app) => {
  const auditLogsRepository = new AuditLogsRepository(app.db);

  app.decorate('auditLogs', auditLogsRepository);

  app.addHook('onSend', async (request, _reply, payload) => {
    if (!shouldAuditRequest(request)) {
      return payload;
    }

    request.auditPayload = parseAuditPayload(payload);
    return payload;
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!shouldPersistAuditLog(request, reply)) {
      return;
    }

    const user = request.user;

    if (!user) {
      return;
    }

    try {
      await auditLogsRepository.create({
        institutionId: user.institutionId,
        userId: user.id,
        action: mapMethodToAction(request.method),
        entity: resolveEntity(request),
        entityId: resolveEntityId(request),
        before: null,
        after: buildAuditAfterSnapshot(request),
      });
    } catch (error) {
      request.log.error(error, 'Failed to persist audit log');
    }
  });
};

function shouldAuditRequest(request: FastifyRequest) {
  return MUTATING_METHODS.has(request.method) && !isExcludedPath(request.url);
}

function shouldPersistAuditLog(request: FastifyRequest, reply: FastifyReply) {
  return (
    shouldAuditRequest(request) &&
    reply.statusCode >= 200 &&
    reply.statusCode < 400 &&
    Boolean(request.user)
  );
}

function isExcludedPath(path: string) {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/docs') ||
    path.startsWith('/health')
  );
}

function parseAuditPayload(payload: unknown) {
  if (typeof payload !== 'string') {
    return payload;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function mapMethodToAction(method: string) {
  switch (method) {
    case 'POST':
      return 'create';
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return method.toLowerCase();
  }
}

function resolveEntity(request: FastifyRequest) {
  const routePath = request.routeOptions.url ?? request.url;

  if (routePath.includes('/students/:studentId/guardians')) {
    return 'student_guardians';
  }

  const segments = routePath.split('/').filter(Boolean);
  const firstSegment = segments[0] ?? 'unknown';

  return firstSegment.replace(/-/g, '_');
}

function resolveEntityId(request: FastifyRequest) {
  const routePath = request.routeOptions.url ?? request.url;
  const params = request.params as Record<string, unknown>;

  if (typeof params.enrollmentId === 'string') {
    return params.enrollmentId;
  }

  if (typeof params.gradeId === 'string') {
    return params.gradeId;
  }

  if (typeof params.attendanceId === 'string') {
    return params.attendanceId;
  }

  if (typeof params.studentId === 'string' && routePath.includes('/students/:studentId/guardians')) {
    return params.studentId;
  }

  if (typeof params.guardianId === 'string') {
    return params.guardianId;
  }

  if (typeof params.academicPeriodId === 'string') {
    return params.academicPeriodId;
  }

  if (typeof params.institutionId === 'string') {
    return params.institutionId;
  }

  const responseData =
    request.auditPayload &&
    typeof request.auditPayload === 'object' &&
    request.auditPayload !== null &&
    'data' in request.auditPayload
      ? (request.auditPayload as { data?: Record<string, unknown> }).data
      : undefined;

  if (responseData && typeof responseData.id === 'string') {
    return responseData.id;
  }

  return null;
}

function buildAuditAfterSnapshot(request: FastifyRequest) {
  return {
    route: request.routeOptions.url,
    method: request.method,
    params: request.params,
    body: request.body ?? null,
    response: request.auditPayload ?? null,
  };
}

export const auditLogsPlugin = fp(auditLogsPluginHandler, {
  name: 'audit-logs-plugin',
  dependencies: ['db-plugin'],
});
