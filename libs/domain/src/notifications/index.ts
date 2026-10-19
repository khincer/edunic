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
export {
  EmailDeliveriesRepository,
  EMAIL_DELIVERY_CURSOR_ORDER,
  EMAIL_DELIVERY_LIST_COLUMNS,
} from './infrastructure/email-deliveries.repository.js';
export type {
  EmailDeliveryRecord,
  EmailDeliveryCompletion,
  EmailDeliveryState,
  EmailSenderIdentity,
  EmailStudentTarget,
  RecipientRecord,
} from './infrastructure/email-deliveries.repository.js';
export {
  emailDeliveryStatusSchema,
  listEmailDeliveriesQuerySchema,
} from './schemas/email-delivery.schemas.js';
export type {
  EmailDeliveryStatus,
  ListEmailDeliveriesQuery,
} from './schemas/email-delivery.schemas.js';
export { emailJobId } from './infrastructure/email-job-queue.js';
export type {
  EmailDeliveryJob,
  EmailJobQueue,
} from './infrastructure/email-job-queue.js';
export {
  EmailDeliveryService,
} from './application/email-delivery.service.js';
export type {
  EmailDeliveryServiceDeps,
  EmailTriggerEvent,
} from './application/email-delivery.service.js';
