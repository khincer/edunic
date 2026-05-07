import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  NotificationsService,
  NotificationsServiceError,
} from '../modules/notifications/application/notifications.service.js';
import { NotificationsRepository } from '../modules/notifications/infrastructure/notifications.repository.js';
import {
  institutionHeaderSchema,
  listNotificationsQuerySchema,
  notificationParamsSchema,
} from '../modules/notifications/schemas/notification.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new NotificationsServiceError(
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

export async function notificationRoutes(app: FastifyInstance) {
  const notificationsService = new NotificationsService(
    new NotificationsRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher'])],
  };

  app.get('/notifications', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listNotificationsQuerySchema, request.query);

    return notificationsService.listNotifications({
      institutionId,
      ...query,
    });
  });

  app.patch('/notifications/:notificationId/read', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(notificationParamsSchema, request.params);

    return notificationsService.markNotificationRead(
      institutionId,
      params.notificationId
    );
  });
}
