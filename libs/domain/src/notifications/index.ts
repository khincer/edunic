export { NotificationsService, NotificationsServiceError } from './application/notifications.service.js';
export { NotificationsRepository } from './infrastructure/notifications.repository.js';
export type { NotificationRecord } from './infrastructure/notifications.repository.js';
export { notificationParamsSchema, listNotificationsQuerySchema } from './schemas/notification.schemas.js';
export type { ListNotificationsQuery } from './schemas/notification.schemas.js';

export {
  buildAbsenceEmail,
  buildGradeEmail,
  buildWelcomeEmail,
} from './application/email-templates.js';
export type { EmailContent } from './application/email-templates.js';
export {
  EmailTransportError,
} from './infrastructure/email-transport.js';
export type {
  EmailTransport,
  SendEmailInput,
  SendEmailResult,
} from './infrastructure/email-transport.js';
export {
  ResendEmailTransport,
  isRetryableResendStatus,
} from './infrastructure/resend-email.transport.js';
export type { ResendEmailClient } from './infrastructure/resend-email.transport.js';
