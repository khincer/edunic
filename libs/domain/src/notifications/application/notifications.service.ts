import type { AcademicDomainEvent } from '@edunic/source/domain/events';
import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
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
      await this.notificationsRepository.isNotificationsExtensionEnabled();

    if (!enabled) {
      return;
    }

    const notification = this.toNotificationInput(event);
    await this.notificationsRepository.create(notification);
  }

  async listNotifications(
    input: ListNotificationsQuery & {
      institutionId: string;
      role?: string;
      userId?: string;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.notificationsRepository.list({
      ...input,
      eventName: input.eventName?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        // created_at is always set by defaultNow(); the column is typed nullable.
        sortKey: (notification) => notification.createdAt as Date,
        id: (notification) => notification.id,
      },
      result.total
    );

    return {
      data: page.data.map((notification) =>
        this.toNotificationResponse(notification)
      ),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async markNotificationRead(input: {
    institutionId: string;
    notificationId: string;
    role?: string;
    userId?: string;
  }) {
    const notification = await this.notificationsRepository.markRead(
      input
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
