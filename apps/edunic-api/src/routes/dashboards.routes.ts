import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  DashboardsService,
  DashboardsServiceError,
  DashboardsRepository,
} from '@edunic/source/domain/dashboards';
import { PaymentsRepository } from '@edunic/source/domain/payments';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import { ADMIN_ROLES, adminAnd, toAudienceRole } from '@edunic/source/domain/authorization';

function getAuthenticatedUser(request: FastifyRequest) {
  if (!request.user) {
    throw new DashboardsServiceError('Authentication is required', 401);
  }

  return request.user;
}

export async function dashboardRoutes(app: FastifyInstance) {
  const dashboardsService = new DashboardsService(
    new DashboardsRepository(app.db),
    new PaymentsRepository(app.db)
  );

  app.get(
    '/admin',
    {
      preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
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
      preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher'))],
    },
    async (request) => {
      const institutionId = getInstitutionId(request);
      const user = getAuthenticatedUser(request);

      return dashboardsService.getTeacherDashboard({
        institutionId,
        userId: user.id,
        role: toAudienceRole(user.role),
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
