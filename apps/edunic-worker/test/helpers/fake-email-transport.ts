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

  get calls(): number {
    return this.sent.length;
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

  reset(): void {
    this.sent.length = 0;
    this.behavior = 'success';
    this.providerMessageId = 'fake-provider-message-id';
    this.failureMessage = 'fake transport failure';
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.sent.push(input);

    if (this.behavior !== 'success') {
      throw new EmailTransportError(
        this.failureMessage,
        this.behavior === 'retryable'
      );
    }

    return { providerMessageId: this.providerMessageId };
  }
}
