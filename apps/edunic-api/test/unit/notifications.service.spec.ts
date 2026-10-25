import { createGradeSubmittedEvent } from '@edunic/source/domain/events';
import { NotificationsService } from '@edunic/source/domain/notifications';

describe('NotificationsService', () => {
  it('creates a notification when the extension is enabled', async () => {
    const repository = {
      isNotificationsExtensionEnabled: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new NotificationsService(repository as never);
    const event = createGradeSubmittedEvent({
      institutionId: '00000000-0000-0000-0000-000000000001',
      payload: {
        gradeId: 'grade-1',
        enrollmentId: 'enrollment-1',
        subject: 'Mathematics',
        score: 92,
      },
    });

    await service.handleDomainEvent(event);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'grade.submitted',
        title: 'Grade submitted',
      })
    );
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty(
      'institutionId'
    );
  });

  it('processes an old-shape event that still carries institutionId', async () => {
    const repository = {
      isNotificationsExtensionEnabled: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue({}),
    };
    const service = new NotificationsService(repository as never);

    await service.handleDomainEvent({
      id: 'queued-before-the-sweep',
      name: 'attendance.marked',
      institutionId: '00000000-0000-0000-0000-000000000001',
      payload: {
        attendanceId: 'attendance-1',
        enrollmentId: 'enrollment-1',
        date: '2026-01-01',
        status: 'present',
      },
      occurredAt: '2026-01-01T00:00:00.000Z',
    } as never);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ eventName: 'attendance.marked' })
    );
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty(
      'institutionId'
    );
  });

  it('does not create a notification when the extension is disabled', async () => {
    const repository = {
      isNotificationsExtensionEnabled: jest.fn().mockResolvedValue(false),
      create: jest.fn(),
    };
    const service = new NotificationsService(repository as never);

    await service.handleDomainEvent(
      createGradeSubmittedEvent({
        institutionId: '00000000-0000-0000-0000-000000000001',
        payload: {
          gradeId: 'grade-1',
          enrollmentId: 'enrollment-1',
          subject: 'Mathematics',
          score: 92,
        },
      })
    );

    expect(repository.create).not.toHaveBeenCalled();
  });
});
