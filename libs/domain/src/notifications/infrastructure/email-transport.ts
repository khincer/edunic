// Email delivery port (design D5). The worker is the only sender and depends on
// this seam, never on a provider SDK: the API process and every test run
// without a Resend key, and a fake transport drops in for tests.

export type SendEmailInput = {
  /** Platform-verified envelope sender (EMAIL_FROM_ADDRESS). */
  from: string;
  /**
   * Institution display name, rendered as the `From:` name beside the platform
   * address (SI-R1). Null or absent leaves the address bare.
   */
  fromName?: string | null;
  /** Per-institution reply-to override; null keeps the platform default. */
  replyTo: string | null;
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = {
  providerMessageId: string;
};

export interface EmailTransport {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

// `retryable` is the retry policy the queue consumes (DR-R1): the delivery
// service rethrows a retryable failure so BullMQ retries the same job, and
// marks a non-retryable one failed at once.
export class EmailTransportError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'EmailTransportError';
  }
}
