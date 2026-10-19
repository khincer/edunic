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
  }

  // The deadline field is part of this parameter type rather than of the port
  // it is read from, so the double compiles against both port shapes.
  async send(
    input: SendEmailInput & { signal?: AbortSignal }
  ): Promise<SendEmailResult> {
    this.sent.push(input);
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
