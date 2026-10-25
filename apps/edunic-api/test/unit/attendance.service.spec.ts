import {
  AttendanceService,
  AttendanceServiceError,
} from '@edunic/source/domain/attendance';

// The teacher scoping check is exercised in the integration specs; here the
// service only needs an access service that does not object.
const access = {
  assertTeacherOwnsEnrollment: jest.fn().mockResolvedValue(undefined),
} as never;

describe('AttendanceService', () => {
  it('returns 404 when the enrollment does not exist', async () => {
    const repository = {
      findEnrollment: jest.fn().mockResolvedValue(null),
    };

    const service = new AttendanceService(repository as never, undefined, access);

    await expect(
      service.createAttendance({
        institutionId: 'inst-1',
      role: 'director',
      userId: 'user-1',
        enrollmentId: 'enrollment-1',
        date: '2026-02-01T08:00:00.000Z',
        status: 'present',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AttendanceServiceError>>({
        message: 'Enrollment not found',
        statusCode: 404,
      })
    );
  });

  const attendanceRecord = {
    id: 'attendance-1',
    institutionId: 'inst-1',
    enrollmentId: 'enrollment-1',
    date: new Date('2026-02-01T08:00:00.000Z'),
    status: 'present',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  function createRepositoryMock(tx: { execute: jest.Mock }) {
    return {
      findEnrollment: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
      create: jest.fn().mockResolvedValue({ id: 'attendance-1' }),
      findById: jest.fn().mockResolvedValue(attendanceRecord),
    };
  }

  it('creates the attendance record and the outbox event inside one repository transaction', async () => {
    const tx = { execute: jest.fn() };
    const repository = createRepositoryMock(tx);
    const publish = jest.fn().mockResolvedValue(undefined);
    const service = new AttendanceService(repository as never, {
      publish,
    } as never);

    const result = await service.createAttendance({
      institutionId: 'inst-1',
      role: 'director',
      userId: 'user-1',
      enrollmentId: 'enrollment-1',
      date: '2026-02-01T08:00:00.000Z',
      status: 'present',
    });

    expect(result.data).toEqual(
      expect.objectContaining({ id: 'attendance-1', status: 'present' })
    );
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: 'enrollment-1', status: 'present' }),
      tx
    );
    expect(repository.findById).toHaveBeenCalledWith(
      'inst-1',
      'attendance-1',
      tx
    );
    // Executor calls on the transaction come only from the outbox helpers:
    // insert (before publish), then mark published (after publish).
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0] as {
      name: string;
      payload: Record<string, unknown>;
    };
    expect(event.name).toBe('attendance.marked');
    expect(event.payload).toEqual(
      expect.objectContaining({ attendanceId: 'attendance-1', status: 'present' })
    );
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      tx.execute.mock.invocationCallOrder[1]
    );
  });

  it('rolls back and surfaces the error when publish fails (P2-R6)', async () => {
    const tx = { execute: jest.fn() };
    const repository = createRepositoryMock(tx);
    const publish = jest
      .fn()
      .mockRejectedValue(new Error('event bus down (injected)'));
    const service = new AttendanceService(repository as never, {
      publish,
    } as never);

    await expect(
      service.createAttendance({
        institutionId: 'inst-1',
      role: 'director',
      userId: 'user-1',
        enrollmentId: 'enrollment-1',
        date: '2026-02-01T08:00:00.000Z',
        status: 'present',
      })
    ).rejects.toThrow('event bus down (injected)');
    expect(repository.create).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it('leaves the outbox row unpublished for the publisher when no bus is attached', async () => {
    const tx = { execute: jest.fn() };
    const repository = createRepositoryMock(tx);
    const service = new AttendanceService(repository as never, undefined, access);

    const result = await service.createAttendance({
      institutionId: 'inst-1',
      role: 'director',
      userId: 'user-1',
      enrollmentId: 'enrollment-1',
      date: '2026-02-01T08:00:00.000Z',
      status: 'present',
    });

    expect(result.data.id).toBe('attendance-1');
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });
});
