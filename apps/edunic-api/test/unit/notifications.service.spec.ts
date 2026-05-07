import { createGradeSubmittedEvent } from '../../src/domain-events.js';
import { NotificationsService } from '../../src/modules/notifications/application/notifications.service.js';

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
        institutionId: event.institutionId,
        eventName: 'grade.submitted',
        title: 'Grade submitted',
      })
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
