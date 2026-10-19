import {
  EmailTransportError,
  type EmailTransport,
  type SendEmailInput,
  type SendEmailResult,
} from './email-transport.js';

// Structural view of the Resend client this adapter uses. Keeping it local
// means the SDK is a type-only import: the adapter never loads the SDK itself,
// so importing the notifications module never needs a key and the worker
// composition root constructs the real client (design D5).
export type ResendEmailClient = {
  emails: {
    send(
      payload: {
        from: string;
        to: string;
        subject: string;
        text: string;
        replyTo?: string;
      },
      // The SDK's second argument (P9/P10): the request options carry the
      // deadline's AbortSignal, which aborts the underlying fetch, and the
      // caller's idempotency key, which the SDK sends as `Idempotency-Key` so
      // the provider recognises a re-send instead of delivering a second
      // message.
      options?: { signal?: AbortSignal; idempotencyKey?: string }
    ): Promise<
      | { data: { id: string }; error: null }
      | { data: null; error: { message: string; statusCode: number | null } }
    >;
  };
};

export function isRetryableResendStatus(statusCode: number | null): boolean {
  // 429 (rate limit) and 5xx are transient and absorbed by the queue retries.
  // A null status means the SDK read no provider status at all, which is
  // transient too. Every other 4xx is a permanent rejection: an invalid key,
  // an unverified from address or a bad payload, where retrying only burns
  // the attempts budget.
  return statusCode === null || statusCode === 429 || statusCode >= 500;
}

export class ResendEmailTransport implements EmailTransport {
  private readonly client: ResendEmailClient;

  constructor(input: { client: ResendEmailClient }) {
    this.client = input.client;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    let response: Awaited<ReturnType<ResendEmailClient['emails']['send']>>;

    try {
      response = await this.client.emails.send(
        {
          from: formatFromAddress(input.from, input.fromName ?? null),
          to: input.to,
          subject: input.subject,
          text: input.text,
          replyTo: input.replyTo ?? undefined,
        },
        // P9: the caller's deadline reaches the provider request. Resend 6.x
        // threads this signal into its fetch, so the abort ends the request
        // instead of merely abandoning it.
        // P10: the caller's idempotency key reaches it too, as the
        // `Idempotency-Key` header the SDK's own option name maps to
        // (`CreateEmailRequestOptions extends PostOptions, IdempotentRequest`),
        // so the provider absorbs a re-send it has already accepted.
        { signal: input.signal, idempotencyKey: input.idempotencyKey }
      );
    } catch (error) {
      // Network, DNS, timeout and deadline failures never reach a provider
      // status.
      throw new EmailTransportError(toErrorMessage(error), true);
    }

    if (response.error) {
      throw new EmailTransportError(
        response.error.message,
        isRetryableResendStatus(response.error.statusCode)
      );
    }

    return { providerMessageId: response.data.id };
  }
}

// SI-R1 (P8): the institution's sender name becomes the From: display name and
// the platform's verified address stays the envelope sender. The name is
// institution-admin input, so it is quoted and stripped of the characters that
// would end the quoted string or start a new header line before it reaches the
// provider.
function formatFromAddress(address: string, name: string | null): string {
  const display =
    name
      ?.replace(/[\r\n"<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? '';

  return display.length > 0 ? `"${display}" <${address}>` : address;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
