import { InMemoryEventBus } from '../../src/events.js';
import { createEnrollmentCreatedEvent } from '../../src/domain-events.js';

describe('InMemoryEventBus', () => {
  it('publishes events to subscribed handlers', async () => {
    const eventBus = new InMemoryEventBus();
    const handler = jest.fn();
    const event = createEnrollmentCreatedEvent({
      institutionId: '00000000-0000-0000-0000-000000000001',
      payload: {
        enrollmentId: 'enrollment-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        classroomId: null,
      },
    });

    eventBus.subscribe('enrollment.created', handler);
    await eventBus.publish(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('unsubscribes handlers', async () => {
    const eventBus = new InMemoryEventBus();
    const handler = jest.fn();
    const unsubscribe = eventBus.subscribe('enrollment.created', handler);
    const event = createEnrollmentCreatedEvent({
      institutionId: '00000000-0000-0000-0000-000000000001',
      payload: {
        enrollmentId: 'enrollment-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        classroomId: null,
      },
    });

    unsubscribe();
    await eventBus.publish(event);

    expect(handler).not.toHaveBeenCalled();
  });
});
