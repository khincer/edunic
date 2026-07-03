import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  DashboardsService,
  DashboardsServiceError,
} from '../modules/dashboards/application/dashboards.service.js';
import { DashboardsRepository } from '../modules/dashboards/infrastructure/dashboards.repository.js';
import { institutionHeaderSchema } from '../modules/dashboards/schemas/dashboard.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new DashboardsServiceError(
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

function getAuthenticatedUser(request: FastifyRequest) {
  if (!request.user) {
    throw new DashboardsServiceError('Authentication is required', 401);
  }

  return request.user;
}

export async function dashboardRoutes(app: FastifyInstance) {
  const dashboardsService = new DashboardsService(
    new DashboardsRepository(app.db)
  );

  app.get(
    '/admin',
    {
      preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
    },
    async (request) => {
      const institutionId = getInstitutionId(request);
      const user = getAuthenticatedUser(request);

      return dashboardsService.getAdminDashboard(institutionId, user.id);
    }
  );

  app.get(
    '/teacher',
    {
      preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher'])],
    },
    async (request) => {
      const institutionId = getInstitutionId(request);
      const user = getAuthenticatedUser(request);

      return dashboardsService.getTeacherDashboard({
        institutionId,
        userId: user.id,
        role: user.role,
      });
    }
  );

  app.get(
    '/parent',
    {
      preHandler: [app.authenticate, app.authorizeRoles(['parent'])],
    },
    async (request) => {
      const institutionId = getInstitutionId(request);
      const user = getAuthenticatedUser(request);

      return dashboardsService.getParentDashboard(institutionId, user.id);
    }
  );
}
