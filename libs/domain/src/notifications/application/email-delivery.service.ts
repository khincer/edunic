import type {
  AttendanceMarkedEvent,
  EnrollmentWelcomedEvent,
  GradeSubmittedEvent,
} from '@edunic/source/domain/events';
import { FeatureFlagsRepository } from '@edunic/source/domain/feature-flags';
import {
  buildAbsenceEmail,
  buildGradeEmail,
  buildWelcomeEmail,
  type EmailContent,
} from './email-templates.js';
import {
  EmailDeliveriesRepository,
  type EmailDeliveryCompletion,
} from '../infrastructure/email-deliveries.repository.js';
import type {
  EmailDeliveryJob,
  EmailJobQueue,
} from '../infrastructure/email-job-queue.js';
import {
  EmailTransportError,
  type EmailTransport,
} from '../infrastructure/email-transport.js';

// EV-R1's three triggers. `enrollment.created` is deliberately absent: the
// worker turns it into `enrollment.welcomed` and only the welcomed event emails.
export type EmailTriggerEvent =
  | EnrollmentWelcomedEvent
  | GradeSubmittedEvent
  | AttendanceMarkedEvent;

export type EmailDeliveryServiceDeps = {
  repository: EmailDeliveriesRepository;
  featureFlags: FeatureFlagsRepository;
  queue: EmailJobQueue;
  transport: EmailTransport;
  /** Platform-verified envelope sender (EMAIL_FROM_ADDRESS). */
  fromAddress: string;
  /** Platform reply-to default (EMAIL_REPLY_TO). */
  defaultReplyTo: string;
};

const EMAIL_NOTIFICATIONS_FLAG = 'email_notifications';
const FLAG_DISABLED_REASON = 'email_notifications disabled';

export class EmailDeliveryService {
  constructor(private readonly deps: EmailDeliveryServiceDeps) {}

  // EV-R1/RC-R1/RC-R2/RC-R3/FL-R2/SI-R3. Order matters: the flag is the first
  // statement, so a disabled institution reads no recipients and writes nothing.
  async enqueueForEvent(event: EmailTriggerEvent): Promise<void> {
    if (!(await this.isEnabled(event.institutionId))) {
      return;
    }

    const sender = await this.deps.repository.findSenderIdentity(
      event.institutionId
    );

    // SI-R3: no sender identity, no send and no platform fallback.
    if (!sender?.senderName) {
      return;
    }

    const student = await this.deps.repository.findDeliveryTarget({
      institutionId: event.institutionId,
      enrollmentId: event.payload.enrollmentId,
    });

    if (!student) {
      return;
    }

    const recipients = await this.deps.repository.resolveRecipients(
      event.institutionId,
      student.studentId
    );

    if (recipients.length === 0) {
      return;
    }

    const content = this.render(event, {
      senderName: sender.senderName,
      studentName: student.studentName,
    });

    // The unique key makes a redelivered event a no-op; the queue add below is
    // still attempted for every recipient so a crash between the two is healed
    // by the deterministic job id.
    await this.deps.repository.insertPending({
      institutionId: event.institutionId,
      eventId: event.id,
      eventName: event.name,
      studentId: student.studentId,
      recipients,
    });

    for (const recipient of recipients) {
      const job: EmailDeliveryJob = {
        institutionId: event.institutionId,
        eventId: event.id,
        recipientAddress: recipient.address,
        from: this.deps.fromAddress,
        replyTo: sender.replyToEmail ?? this.deps.defaultReplyTo,
        to: recipient.address,
        subject: content.subject,
        text: content.text,
      };

      await this.deps.queue.enqueue(job);
    }
  }

  // The send path. The claim guard that admits exactly one send per delivery
  // record is added separately; this method records the outcome (DR-R1) and
  // rethrows a retryable provider failure so BullMQ retries the same job id.
  async handleDeliveryJob(job: EmailDeliveryJob): Promise<void> {
    if (!(await this.isEnabled(job.institutionId))) {
      await this.complete(job, {
        status: 'failed',
        providerError: FLAG_DISABLED_REASON,
      });
      return;
    }

    try {
      const result = await this.deps.transport.send({
        from: job.from,
        replyTo: job.replyTo,
        to: job.to,
        subject: job.subject,
        text: job.text,
      });

      await this.complete(job, {
        status: 'sent',
        providerMessageId: result.providerMessageId,
      });
    } catch (error) {
      if (error instanceof EmailTransportError && error.retryable) {
        await this.complete(job, {
          status: 'retried',
          providerError: error.message,
        });
        throw error;
      }

      await this.complete(job, {
        status: 'failed',
        providerError: toErrorMessage(error),
      });
    }
  }

  private async isEnabled(institutionId: string): Promise<boolean> {
    // D7: a missing flag row reads as disabled.
    const flag = await this.deps.featureFlags.findEffective(
      institutionId,
      EMAIL_NOTIFICATIONS_FLAG
    );

    return flag?.enabled === true;
  }

  private async complete(
    job: EmailDeliveryJob,
    completion: EmailDeliveryCompletion
  ): Promise<void> {
    await this.deps.repository.completeDelivery({
      institutionId: job.institutionId,
      eventId: job.eventId,
      recipientAddress: job.recipientAddress,
      completion,
    });
  }

  private render(
    event: EmailTriggerEvent,
    context: { senderName: string; studentName: string }
  ): EmailContent {
    switch (event.name) {
      case 'enrollment.welcomed':
        return buildWelcomeEmail(context);
      case 'grade.submitted':
        return buildGradeEmail({
          ...context,
          courseName: event.payload.subject,
          score: event.payload.score,
        });
      default:
        return buildAbsenceEmail({
          ...context,
          date: event.payload.date,
        });
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
