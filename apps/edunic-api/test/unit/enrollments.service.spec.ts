import {
  EnrollmentsService,
  EnrollmentsServiceError,
} from '@edunic/source/domain/enrollments';

describe('EnrollmentsService', () => {
  it('returns 404 when student is outside the institution', async () => {
    const repository = {
      findStudent: jest.fn().mockResolvedValue(null),
      findAcademicPeriod: jest.fn().mockResolvedValue({ id: 'period-1' }),
      findClassroom: jest.fn().mockResolvedValue(null),
    };

    const service = new EnrollmentsService(repository as never);

    await expect(
      service.createEnrollment({
        institutionId: 'inst-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        status: 'active',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<EnrollmentsServiceError>>({
        message: 'Student not found',
        statusCode: 404,
      })
    );
  });

  it('returns 409 when the repository raises a duplicate enrollment error', async () => {
    const repository = {
      transaction: jest.fn(
        async (fn: (tx: { execute: jest.Mock }) => Promise<unknown>) =>
          fn({ execute: jest.fn() })
      ),
      findStudent: jest.fn().mockResolvedValue({ id: 'student-1' }),
      findAcademicPeriod: jest.fn().mockResolvedValue({ id: 'period-1' }),
      findClassroom: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue({ code: '23505' }),
    };

    const service = new EnrollmentsService(repository as never);

    await expect(
      service.createEnrollment({
        institutionId: 'inst-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        status: 'active',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<EnrollmentsServiceError>>({
        message: 'Student is already enrolled in this academic period',
        statusCode: 409,
      })
    );
  });

  it('creates the enrollment and the outbox event inside one repository transaction', async () => {
    const record = {
      id: 'enrollment-1',
      institutionId: 'inst-1',
      studentId: 'student-1',
      academicPeriodId: 'period-1',
      classroomId: null,
      status: 'active',
      promotionStatus: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
    };
    const tx = { execute: jest.fn() };
    const repository = {
      findStudent: jest.fn().mockResolvedValue({ id: 'student-1' }),
      findAcademicPeriod: jest.fn().mockResolvedValue({ id: 'period-1' }),
      findClassroom: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
      create: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      findById: jest.fn().mockResolvedValue(record),
    };
    const publish = jest.fn().mockResolvedValue(undefined);
    const service = new EnrollmentsService(repository as never, {
      publish,
    } as never);

    const result = await service.createEnrollment({
      institutionId: 'inst-1',
      studentId: 'student-1',
      academicPeriodId: 'period-1',
      status: 'active',
    });

    expect(result.data).toEqual(
      expect.objectContaining({ id: 'enrollment-1', studentId: 'student-1' })
    );
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-1' }),
      tx
    );
    expect(repository.findById).toHaveBeenCalledWith(
      'inst-1',
      'enrollment-1',
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
    expect(event.name).toBe('enrollment.created');
    expect(event.payload).toEqual(
      expect.objectContaining({ enrollmentId: 'enrollment-1' })
    );
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      tx.execute.mock.invocationCallOrder[1]
    );
  });

  it('rolls back and surfaces the error when publish fails (P2-R6)', async () => {
    const tx = { execute: jest.fn() };
    const repository = {
      findStudent: jest.fn().mockResolvedValue({ id: 'student-1' }),
      findAcademicPeriod: jest.fn().mockResolvedValue({ id: 'period-1' }),
      findClassroom: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
      create: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      findById: jest.fn().mockResolvedValue({
        id: 'enrollment-1',
        institutionId: 'inst-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        classroomId: null,
        status: 'active',
        promotionStatus: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        studentFirstName: 'Ada',
        studentLastName: 'Lovelace',
      }),
    };
    const publish = jest
      .fn()
      .mockRejectedValue(new Error('event bus down (injected)'));
    const service = new EnrollmentsService(repository as never, {
      publish,
    } as never);

    // The publish failure escapes the repository transaction, which is what
    // makes the real drizzle transaction roll the staged rows back.
    await expect(
      service.createEnrollment({
        institutionId: 'inst-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        status: 'active',
      })
    ).rejects.toThrow('event bus down (injected)');
    expect(repository.create).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    // Only the outbox insert ran; the row was never marked published.
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it('leaves the outbox row unpublished for the publisher when no bus is attached', async () => {
    const tx = { execute: jest.fn() };
    const repository = {
      findStudent: jest.fn().mockResolvedValue({ id: 'student-1' }),
      findAcademicPeriod: jest.fn().mockResolvedValue({ id: 'period-1' }),
      findClassroom: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
      create: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      findById: jest.fn().mockResolvedValue({
        id: 'enrollment-1',
        institutionId: 'inst-1',
        studentId: 'student-1',
        academicPeriodId: 'period-1',
        classroomId: null,
        status: 'active',
        promotionStatus: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        studentFirstName: 'Ada',
        studentLastName: 'Lovelace',
      }),
    };
    const service = new EnrollmentsService(repository as never);

    const result = await service.createEnrollment({
      institutionId: 'inst-1',
      studentId: 'student-1',
      academicPeriodId: 'period-1',
      status: 'active',
    });

    expect(result.data.id).toBe('enrollment-1');
    // Outbox insert only — no publish, no published_at mark; the background
    // outbox publisher picks the row up later.
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });
});
