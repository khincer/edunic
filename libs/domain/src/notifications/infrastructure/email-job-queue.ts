import { createHash } from 'node:crypto';

// The enqueue seam (design D2). The port keeps the delivery service free of
// the queue library so the API bundle never loads BullMQ; the worker supplies
// the BullMQ implementation (apps/edunic-worker/src/email).
export type EmailDeliveryJob = {
  institutionId: string;
  /** Envelope id of the triggering event — half of the deterministic job id. */
  eventId: string;
  /** Normalized recipient address — the other half. */
  recipientAddress: string;
  from: string;
  replyTo: string | null;
  to: string;
  subject: string;
  text: string;
};

export interface EmailJobQueue {
  enqueue(job: EmailDeliveryJob): Promise<void>;
  close(): Promise<void>;
}

// The deterministic job id is the load-bearing half of OC-R1: BullMQ refuses a
// duplicate id while the job record exists, so a redelivered event re-adds a
// job that is already there and does nothing. The corrected form has no ':' —
// BullMQ reserves that separator for its own ids (design D2 correction).
export function emailJobId(eventId: string, recipientAddress: string): string {
  const digest = createHash('sha256')
    .update(recipientAddress.trim().toLowerCase())
    .digest('hex');

  return `email-${eventId}-${digest}`;
}
