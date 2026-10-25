import {
  EmailDeliveryService,
  type EmailDeliveryJob,
} from '@edunic/source/domain/notifications';

// S1.4c: email delivery no longer reads or writes institution_id. The
// repository is mocked so the exact call shapes (no institution argument) are
// the assertion; the SQL itself is covered by the integration specs.
const OLD_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';

function createService() {
  const repository = {
    findSenderIdentity: jest
      .fn()
      .mockResolvedValue({ senderName: 'Colegio', replyToEmail: null }),
    findDeliveryTarget: jest
      .fn()
      .mockResolvedValue({ studentId: 'student-1', studentName: 'Ana Perez' }),
    resolveRecipients: jest
      .fn()
      .mockResolvedValue([{ address: 'maria@example.com', source: 'guardian' }]),
    insertPending: jest.fn().mockResolvedValue(undefined),
    claimDelivery: jest
      .fn()
      .mockResolvedValue({ id: 'ledger-row-1', attemptCount: 1 }),
    completeDelivery: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockResolvedValue({
      emailNotificationsEnabled: true,
      senderIdentityConfigured: true,
    }),
    list: jest.fn().mockResolvedValue({ items: [] }),
  };
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined), close: jest.fn() };
  const transport = {
    send: jest.fn().mockResolvedValue({ providerMessageId: 'provider-1' }),
  };
  const service = new EmailDeliveryService({
    repository: repository as never,
    featureFlags: {
      findByKey: jest.fn().mockResolvedValue({ enabled: true }),
    } as never,
    queue,
    transport,
    fromAddress: 'no-reply@example.com',
    defaultReplyTo: 'reply@example.com',
  });

  return { service, repository, queue, transport };
}

const welcomed = {
  id: 'event-1',
  name: 'enrollment.welcomed' as const,
  payload: { enrollmentId: 'enrollment-1', studentId: 'student-1' },
  occurredAt: '2026-01-01T00:00:00.000Z',
};

describe('EmailDeliveryService without institutionId', () => {
  it('enqueues for an event with no institutionId and passes none down', async () => {
    const { service, repository, queue } = createService();

    await service.enqueueForEvent(welcomed);

    expect(repository.findSenderIdentity).toHaveBeenCalledWith();
    expect(repository.findDeliveryTarget).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-1',
    });
    expect(repository.resolveRecipients).toHaveBeenCalledWith('student-1');
    expect(repository.insertPending.mock.calls[0][0]).not.toHaveProperty(
      'institutionId'
    );
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue.mock.calls[0][0]).not.toHaveProperty('institutionId');
  });

  it('processes an old-shape event that still carries institutionId', async () => {
    const { service, repository, queue } = createService();

    await service.enqueueForEvent({
      ...welcomed,
      institutionId: OLD_SCHOOL_ID,
    } as typeof welcomed);

    expect(repository.findSenderIdentity).toHaveBeenCalledWith();
    expect(repository.findDeliveryTarget).toHaveBeenCalledWith({
      enrollmentId: 'enrollment-1',
    });
    expect(repository.insertPending.mock.calls[0][0]).not.toHaveProperty(
      'institutionId'
    );
    expect(queue.enqueue.mock.calls[0][0]).not.toHaveProperty('institutionId');
  });

  it('sends a job queued before the sweep and keeps the provider idempotency key', async () => {
    const { service, repository, transport } = createService();
    const oldJob = {
      institutionId: OLD_SCHOOL_ID,
      eventId: 'event-1',
      recipientAddress: 'maria@example.com',
      from: 'no-reply@example.com',
      fromName: 'Colegio',
      replyTo: null,
      to: 'maria@example.com',
      subject: 'Welcome',
      text: 'Hello',
    } as EmailDeliveryJob;

    await service.handleDeliveryJob(oldJob);

    // The ledger key is (event, recipient) only.
    expect(repository.claimDelivery).toHaveBeenCalledWith({
      eventId: 'event-1',
      recipientAddress: 'maria@example.com',
    });
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'ledger-row-1' })
    );
    expect(repository.completeDelivery).toHaveBeenCalledWith({
      eventId: 'event-1',
      recipientAddress: 'maria@example.com',
      completion: { status: 'sent', providerMessageId: 'provider-1' },
    });
  });

  it('reads the delivery state without an institution argument', async () => {
    const { service, repository } = createService();

    await expect(service.getState()).resolves.toEqual({
      data: {
        emailNotificationsEnabled: true,
        senderIdentityConfigured: true,
      },
    });
    expect(repository.getState).toHaveBeenCalledWith();
  });

  it('answers 404 when the single school row is missing', async () => {
    const { service, repository } = createService();
    repository.getState.mockResolvedValue(null);

    await expect(service.getState()).rejects.toMatchObject({ statusCode: 404 });
  });
});
