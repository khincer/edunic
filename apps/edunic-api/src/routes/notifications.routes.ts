import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  getInstitutionId,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  NotificationsService,
  NotificationsServiceError,
  NotificationsRepository,
  notificationParamsSchema,
  listNotificationsQuerySchema,
} from '@edunic/source/domain/notifications';

const NOTIFICATION_FILTER_SORT_OPTIONS = {
  filterFields: ['eventName', 'title', 'createdAt'],
  sortFields: ['eventName', 'title', 'createdAt'],
};

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

  app.get('/notifications', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listNotificationsQuerySchema, request.query);
    const user = getAuthenticatedUser(request);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      NOTIFICATION_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return notificationsService.listNotifications({
      institutionId,
      role: user.role,
      userId: user.id,
      ...query,
      filters,
      sort,
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
