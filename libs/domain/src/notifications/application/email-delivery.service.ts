import type {
  AttendanceMarkedEvent,
  EnrollmentWelcomedEvent,
  GradeSubmittedEvent,
} from '@edunic/source/domain/events';
import { FeatureFlagsRepository } from '@edunic/source/domain/feature-flags';
import { buildCursorPage } from '@edunic/source/domain/shared';
import {
  buildAttendanceEmail,
  buildGradeEmail,
  buildWelcomeEmail,
  type EmailContent,
} from './email-templates.js';
import {
  EmailDeliveriesRepository,
  type EmailDeliveryCompletion,
  type ListEmailDeliveriesInput,
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
  // The send path below. The worker wires all five; the API process wires none
  // of them, because it only serves the read-only admin panel (design D1/D6).
  featureFlags?: FeatureFlagsRepository;
  queue?: EmailJobQueue;
  transport?: EmailTransport;
  /** Platform-verified envelope sender (EMAIL_FROM_ADDRESS). */
  fromAddress?: string;
  /** Platform reply-to default (EMAIL_REPLY_TO). */
  defaultReplyTo?: string;
};

type EmailDeliverySendDeps = Required<
  Pick<
    EmailDeliveryServiceDeps,
    'featureFlags' | 'queue' | 'transport' | 'fromAddress' | 'defaultReplyTo'
  >
>;

export class EmailDeliveryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'EmailDeliveryServiceError';
  }
}

const EMAIL_NOTIFICATIONS_FLAG = 'email_notifications';
const FLAG_DISABLED_REASON = 'email_notifications disabled';

export class EmailDeliveryService {
  constructor(private readonly deps: EmailDeliveryServiceDeps) {}

  // A missing send-path group can only be a worker wiring bug, so it fails
  // loudly instead of silently skipping a delivery.
  private get sender(): EmailDeliverySendDeps {
    const { featureFlags, queue, transport, fromAddress, defaultReplyTo } =
      this.deps;

    if (
      !featureFlags ||
      !queue ||
      !transport ||
      !fromAddress ||
      !defaultReplyTo
    ) {
      throw new Error('Email delivery send dependencies are not configured');
    }

    return { featureFlags, queue, transport, fromAddress, defaultReplyTo };
  }

  // EV-R1/RC-R1/RC-R2/RC-R3/FL-R2/SI-R3. Order matters: the flag is the first
  // statement, so a disabled institution reads no recipients and writes nothing.
  async enqueueForEvent(event: EmailTriggerEvent): Promise<void> {
    const sendDeps = this.sender;

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
        from: sendDeps.fromAddress,
        // SI-R1: the display name the institution configured, kept beside the
        // platform envelope address the transport actually sends from.
        fromName: sender.senderName,
        replyTo: sender.replyToEmail ?? sendDeps.defaultReplyTo,
        to: recipient.address,
        subject: content.subject,
        text: content.text,
      };

      await sendDeps.queue.enqueue(job);
    }
  }

  // The send path. D2/OC-R1: the guarded claim is the job's first write, so a
  // job that arrives for a row already in flight or final leaves without
  // touching the transport. The claim also records the outcome (DR-R1) and
  // rethrows a retryable provider failure so BullMQ retries the same job id.
  async handleDeliveryJob(job: EmailDeliveryJob): Promise<void> {
    const claim = await this.deps.repository.claimDelivery({
      institutionId: job.institutionId,
      eventId: job.eventId,
      recipientAddress: job.recipientAddress,
    });

    // Zero rows: another attempt owns this row, or it is done. Do not send.
    if (!claim) {
      return;
    }

    if (!(await this.isEnabled(job.institutionId))) {
      await this.complete(job, {
        status: 'failed',
        providerError: FLAG_DISABLED_REASON,
      });
      return;
    }

    try {
      const result = await this.sender.transport.send({
        from: job.from,
        fromName: job.fromName ?? null,
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

  // PN-R1/DR-R2: the admin panel list. Same CursorPage envelope as every other
  // list endpoint (offset when no cursor, keyset when there is one).
  async listDeliveries(input: ListEmailDeliveriesInput) {
    const result = await this.deps.repository.list(input);
    const total = 'total' in result ? result.total : undefined;

    const page = buildCursorPage(
      result.items,
      input,
      {
        // created_at is always set by defaultNow().
        sortKey: (delivery) => delivery.createdAt as Date,
        id: (delivery) => delivery.id,
      },
      total
    );

    return {
      data: page.data,
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  // PN-R3/SI-R3: the flag and sender-identity state the panel banner reads. Not
  // gated by the flag: the panel stays visible when email is off.
  async getState(institutionId: string) {
    const state = await this.deps.repository.getState(institutionId);

    if (!state) {
      throw new EmailDeliveryServiceError('Institution not found', 404);
    }

    return { data: state };
  }

  private async isEnabled(institutionId: string): Promise<boolean> {
    // D7: a missing flag row reads as disabled.
    const flag = await this.sender.featureFlags.findEffective(
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
        return buildAttendanceEmail({
          ...context,
          date: event.payload.date,
          status: event.payload.status,
        });
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
