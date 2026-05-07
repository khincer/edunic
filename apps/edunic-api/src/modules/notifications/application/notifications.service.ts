import type { AcademicDomainEvent } from '../../../domain-events.js';
import type { ListNotificationsQuery } from '../schemas/notification.schemas.js';
import {
  NotificationsRepository,
  type NotificationRecord,
} from '../infrastructure/notifications.repository.js';

export class NotificationsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'NotificationsServiceError';
  }
}

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async handleDomainEvent(event: AcademicDomainEvent) {
    const enabled =
      await this.notificationsRepository.isNotificationsExtensionEnabled(
        event.institutionId
      );

    if (!enabled) {
      return;
    }

    const notification = this.toNotificationInput(event);
    await this.notificationsRepository.create(notification);
  }

  async listNotifications(
    input: ListNotificationsQuery & { institutionId: string }
  ) {
    const result = await this.notificationsRepository.list({
      ...input,
      eventName: input.eventName?.trim() || undefined,
    });

    return {
      data: result.items.map((notification) =>
        this.toNotificationResponse(notification)
      ),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async markNotificationRead(institutionId: string, notificationId: string) {
    const notification = await this.notificationsRepository.markRead(
      institutionId,
      notificationId
    );

    if (!notification) {
      throw new NotificationsServiceError('Notification not found', 404);
    }

    return {
      data: this.toNotificationResponse(notification),
    };
  }

  private toNotificationInput(event: AcademicDomainEvent) {
    if (event.name === 'enrollment.created') {
      return {
        institutionId: event.institutionId,
        eventName: event.name,
        title: 'Enrollment created',
        message: `Enrollment ${event.payload.enrollmentId} was created`,
        metadata: event,
      };
    }

    if (event.name === 'grade.submitted') {
      return {
        institutionId: event.institutionId,
        eventName: event.name,
        title: 'Grade submitted',
        message: `${event.payload.subject} grade was submitted`,
        metadata: event,
      };
    }

    return {
      institutionId: event.institutionId,
      eventName: event.name,
      title: 'Attendance marked',
      message: `Attendance ${event.payload.status} was marked`,
      metadata: event,
    };
  }

  private toNotificationResponse(notification: NotificationRecord) {
    return {
      id: notification.id,
      institutionId: notification.institutionId,
      eventName: notification.eventName,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
