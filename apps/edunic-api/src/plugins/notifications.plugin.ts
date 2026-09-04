import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type {
  AttendanceMarkedEvent,
  EnrollmentCreatedEvent,
  GradeSubmittedEvent,
} from '@edunic/source/domain/events';
import { NotificationsService, NotificationsRepository } from '@edunic/source/domain/notifications';

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
