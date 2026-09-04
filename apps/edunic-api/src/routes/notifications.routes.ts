import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  NotificationsService,
  NotificationsServiceError,
  NotificationsRepository,
  institutionHeaderSchema,
  notificationParamsSchema,
  listNotificationsQuerySchema,
} from '@edunic/source/domain/notifications';

function getAuthenticatedUser(request: FastifyRequest) {
  if (!request.user) {
    throw new NotificationsServiceError('Authentication is required', 401);
  }

  return request.user;
}

export async function notificationRoutes(app: FastifyInstance) {
  const notificationsService = new NotificationsService(
    new NotificationsRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };

  app.get('/notifications', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listNotificationsQuerySchema, request.query);
    const user = getAuthenticatedUser(request);

    return notificationsService.listNotifications({
      institutionId,
      role: user.role,
      userId: user.id,
      ...query,
    });
  });

  app.patch('/notifications/:notificationId/read', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(notificationParamsSchema, request.params);
    const user = getAuthenticatedUser(request);

    return notificationsService.markNotificationRead({
      institutionId,
      notificationId: params.notificationId,
      role: user.role,
      userId: user.id,
    });
  });
}
