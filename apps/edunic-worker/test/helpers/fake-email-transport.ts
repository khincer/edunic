import {
  EmailTransportError,
  type EmailTransport,
  type SendEmailInput,
  type SendEmailResult,
} from '@edunic/source/domain/notifications';

// Task 4.1 (design D5): recording and programmable EmailTransport double. The
// worker suite asserts on `sent` and flips the behaviour to exercise the retry
// classification — no HTTP, no API key and no provider involved.
type FakeBehavior = 'success' | 'retryable' | 'non-retryable';

export class FakeEmailTransport implements EmailTransport {
  readonly sent: SendEmailInput[] = [];

  private behavior: FakeBehavior = 'success';
  private providerMessageId = 'fake-provider-message-id';
  private failureMessage = 'fake transport failure';
  private hangMs: number | null = null;
  private inFlightCount = 0;
  private peakInFlightCount = 0;
  private deliveredCount = 0;
  // What the provider has already accepted, keyed by the caller's idempotency
  // key — the way a real provider recognises a re-send.
  private readonly accepted = new Map<string, string>();

  get calls(): number {
    return this.sent.length;
  }

  /**
   * Sends that reached the provider. An attempt the caller aborted at its
   * deadline never counts: that difference is exactly one email versus two.
   */
  get delivered(): number {
    return this.deliveredCount;
  }

  /** The most sends that were ever in flight at the same time. */
  get peakInFlight(): number {
    return this.peakInFlightCount;
  }

  get inFlight(): number {
    return this.inFlightCount;
  }

  succeedWith(providerMessageId = 'fake-provider-message-id'): this {
    this.behavior = 'success';
    this.providerMessageId = providerMessageId;
    return this;
  }

  failRetryable(message = 'fake retryable failure'): this {
    this.behavior = 'retryable';
    this.failureMessage = message;
    return this;
  }

  failNonRetryable(message = 'fake non-retryable failure'): this {
    this.behavior = 'non-retryable';
    this.failureMessage = message;
    return this;
  }

  /**
   * The next send hangs for `ms` and then succeeds — a slow provider, not an
   * unreachable one — unless the caller aborts it through the port's deadline
   * signal, in which case the send never reaches the provider.
   */
  hangOnceFor(ms: number): this {
    this.hangMs = ms;
    return this;
  }

  reset(): void {
    this.sent.length = 0;
    this.behavior = 'success';
    this.providerMessageId = 'fake-provider-message-id';
    this.failureMessage = 'fake transport failure';
    this.hangMs = null;
    this.inFlightCount = 0;
    this.peakInFlightCount = 0;
    this.deliveredCount = 0;
    this.accepted.clear();
  }

  /**
   * The provider absorbs a re-send it has already accepted under the same
   * idempotency key: no second message, the original message id comes back.
   * Without a key there is nothing to recognise it by, so the message is
   * delivered again — which is what the duplicate this double exists to
   * reproduce looks like.
   */
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.sent.push(input);

    const acceptedId = input.idempotencyKey
      ? this.accepted.get(input.idempotencyKey)
      : undefined;

    if (acceptedId !== undefined) {
      return { providerMessageId: acceptedId };
    }

    this.inFlightCount += 1;
    this.peakInFlightCount = Math.max(
      this.peakInFlightCount,
      this.inFlightCount
    );

    try {
      const hangMs = this.hangMs;

      if (hangMs !== null) {
        this.hangMs = null;
        await delayOrAbort(hangMs, input.signal);
      }

      if (this.behavior !== 'success') {
        throw new EmailTransportError(
          this.failureMessage,
          this.behavior === 'retryable'
        );
      }

      this.deliveredCount += 1;

      if (input.idempotencyKey !== undefined) {
        this.accepted.set(input.idempotencyKey, this.providerMessageId);
      }

      return { providerMessageId: this.providerMessageId };
    } finally {
      this.inFlightCount -= 1;
    }
  }
}

function delayOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new EmailTransportError('fake transport aborted by deadline', true));
    };

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}
