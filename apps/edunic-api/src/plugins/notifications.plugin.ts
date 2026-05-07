import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type {
  AttendanceMarkedEvent,
  EnrollmentCreatedEvent,
  GradeSubmittedEvent,
} from '../domain-events.js';
import { NotificationsService } from '../modules/notifications/application/notifications.service.js';
import { NotificationsRepository } from '../modules/notifications/infrastructure/notifications.repository.js';

const notificationsPluginHandler: FastifyPluginAsync = async (app) => {
  const notificationsService = new NotificationsService(
    new NotificationsRepository(app.db)
  );

  const unsubscribeEnrollment = app.eventBus.subscribe<EnrollmentCreatedEvent>(
    'enrollment.created',
    (event) => notificationsService.handleDomainEvent(event)
  );
  const unsubscribeGrade = app.eventBus.subscribe<GradeSubmittedEvent>(
    'grade.submitted',
    (event) => notificationsService.handleDomainEvent(event)
  );
  const unsubscribeAttendance = app.eventBus.subscribe<AttendanceMarkedEvent>(
    'attendance.marked',
    (event) => notificationsService.handleDomainEvent(event)
  );

  app.addHook('onClose', async () => {
    unsubscribeEnrollment();
    unsubscribeGrade();
    unsubscribeAttendance();
  });
};

export const notificationsPlugin = fp(notificationsPluginHandler, {
  name: 'notifications-plugin',
  dependencies: ['db-plugin', 'event-bus-plugin'],
});
