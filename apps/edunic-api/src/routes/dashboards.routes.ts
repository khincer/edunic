import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  DashboardsService,
  DashboardsServiceError,
  DashboardsRepository,
  institutionHeaderSchema,
} from '@edunic/source/domain/dashboards';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';

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
