import { Resend } from 'resend';
import {
  EmailTransportError,
  ResendEmailTransport,
  type ResendEmailClient,
} from '@edunic/source/domain/notifications';

const message = {
  from: 'notifications@edunic.test',
  fromName: null,
  replyTo: null,
  to: 'family@example.com',
  subject: 'Welcome to Colegio Las Flores',
  text: 'Hello,',
};

function clientReturning(response: unknown): ResendEmailClient {
  return {
    emails: { send: jest.fn().mockResolvedValue(response) },
  };
}

function clientThrowing(error: unknown): ResendEmailClient {
  return {
    emails: { send: jest.fn().mockRejectedValue(error) },
  };
}

async function expectTransportError(
  client: ResendEmailClient,
  retryable: boolean
): Promise<void> {
  const transport = new ResendEmailTransport({ client });

  await expect(transport.send(message)).rejects.toBeInstanceOf(
    EmailTransportError
  );

  const transport2 = new ResendEmailTransport({ client });

  try {
    await transport2.send(message);
    throw new Error('expected send to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(EmailTransportError);
    expect((error as EmailTransportError).retryable).toBe(retryable);
  }
}

// Classification is the retry policy (DR-R1, design D8): 429 and 5xx are
// transient and absorbed by BullMQ's retries; other 4xx are permanent
// rejections the panel surfaces without a retry storm.
describe('ResendEmailTransport', () => {
  it('returns the provider message id on acceptance', async () => {
    const transport = new ResendEmailTransport({
      client: clientReturning({
        data: { id: 'provider-message-1' },
        error: null,
      }),
    });

    await expect(transport.send(message)).resolves.toEqual({
      providerMessageId: 'provider-message-1',
    });
  });

  it('sends the envelope sender, reply-to, body and dedupe key the provider expects', async () => {
    const client = clientReturning({ data: { id: 'id-1' }, error: null });
    const transport = new ResendEmailTransport({ client });

    await transport.send({
      ...message,
      replyTo: 'replies@colegio.test',
      idempotencyKey: 'delivery-row-1',
    });

    expect(client.emails.send).toHaveBeenCalledWith(
      {
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        replyTo: 'replies@colegio.test',
      },
      // P9/P10: the second argument is the request options. `signal` is the
      // caller's deadline and `idempotencyKey` is the key the SDK sends as the
      // `Idempotency-Key` header, so the provider can absorb a re-send.
      { signal: undefined, idempotencyKey: 'delivery-row-1' }
    );
  });

  it('renders the institution sender name as the From display name', async () => {
    const client = clientReturning({ data: { id: 'id-1' }, error: null });
    const transport = new ResendEmailTransport({ client });

    await transport.send({ ...message, fromName: 'Colegio Las Flores' });

    // The platform address stays the envelope sender; only the display name is
    // the institution's (P8/SI-R1).
    expect(client.emails.send).toHaveBeenCalledWith(
      {
        from: '"Colegio Las Flores" <notifications@edunic.test>',
        to: message.to,
        subject: message.subject,
        text: message.text,
        replyTo: undefined,
      },
      { signal: undefined, idempotencyKey: undefined }
    );
  });

  it('keeps a header-breaking display name inside the quoted name', async () => {
    const client = clientReturning({ data: { id: 'id-1' }, error: null });
    const transport = new ResendEmailTransport({ client });

    await transport.send({
      ...message,
      fromName: 'Evil "School"\r\nBcc: attacker@example.com',
    });

    const sent = (client.emails.send as jest.Mock).mock.calls[0][0] as {
      from: string;
    };

    // No header break survives, and the name cannot close its own quoting.
    expect(sent.from).not.toMatch(/[\r\n]/);
    expect(sent.from).toBe(
      '"Evil School Bcc: attacker@example.com" <notifications@edunic.test>'
    );
  });

  it('classifies a provider 429 as retryable', async () => {
    await expectTransportError(
      clientReturning({
        data: null,
        error: { message: 'Rate limit exceeded', statusCode: 429 },
      }),
      true
    );
  });

  it('classifies provider 5xx responses as retryable', async () => {
    for (const statusCode of [500, 503]) {
      await expectTransportError(
        clientReturning({
          data: null,
          error: { message: 'Internal server error', statusCode },
        }),
        true
      );
    }
  });

  it('classifies other provider 4xx responses as not retryable', async () => {
    for (const statusCode of [400, 403, 422]) {
      await expectTransportError(
        clientReturning({
          data: null,
          error: { message: 'Invalid from address', statusCode },
        }),
        false
      );
    }
  });

  it('classifies an error without a provider status as retryable', async () => {
    await expectTransportError(
      clientReturning({
        data: null,
        error: { message: 'Unknown provider failure', statusCode: null },
      }),
      true
    );
  });

  it('classifies a thrown network failure as retryable', async () => {
    await expectTransportError(
      clientThrowing(new TypeError('fetch failed')),
      true
    );
  });

  it('carries the provider error message on a non-retryable rejection', async () => {
    const transport = new ResendEmailTransport({
      client: clientReturning({
        data: null,
        error: { message: 'Invalid from address', statusCode: 422 },
      }),
    });

    await expect(transport.send(message)).rejects.toThrow(
      'Invalid from address'
    );
  });

  it('is constructible with the real SDK client while RESEND_API_KEY is unset', () => {
    const previousKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      // The SDK is constructed by the worker composition root, never at module
      // import, so importing this seam never needs a key (design D5).
      const transport = new ResendEmailTransport({
        client: new Resend('re_test_key'),
      });

      expect(typeof transport.send).toBe('function');
    } finally {
      if (previousKey !== undefined) {
        process.env.RESEND_API_KEY = previousKey;
      }
    }
  });
});
