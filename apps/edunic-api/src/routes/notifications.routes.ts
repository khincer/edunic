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
  EmailDeliveryService,
  EmailDeliveriesRepository,
  listEmailDeliveriesQuerySchema,
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
  // PN-R1/PN-R3: the panel is admin-only — rows carry family email addresses.
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };
  // The API only reads the panel (design D1): no queue, no transport, no flag
  // writes, so the service is wired with the repository alone.
  const emailDeliveryService = new EmailDeliveryService({
    repository: new EmailDeliveriesRepository(app.db),
  });

  app.get('/notifications/deliveries', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(
      listEmailDeliveriesQuerySchema,
      request.query
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return emailDeliveryService.listDeliveries({ institutionId, ...query });
  });

  app.get('/notifications/deliveries/state', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);

    return emailDeliveryService.getState(institutionId);
  });

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
