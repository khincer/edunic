import {
  EnrollmentsService,
  EnrollmentsServiceError,
} from '@edunic/source/domain/enrollments';

describe('EnrollmentsService', () => {
  it('returns 404 when the student does not exist', async () => {
    const repository = {
      findStudent: jest.fn().mockResolvedValue(null),
      findAcademicPeriod: jest.fn().mockResolvedValue({ id: 'period-1' }),
      findClassroom: jest.fn().mockResolvedValue(null),
    };

    const service = new EnrollmentsService(repository as never, {} as never);

    await expect(
      service.createEnrollment({
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

    const service = new EnrollmentsService(repository as never, {} as never);

    await expect(
      service.createEnrollment({
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
    const service = new EnrollmentsService(repository as never, {} as never, {
      publish,
    } as never);

    const result = await service.createEnrollment({
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
    expect(repository.findById).toHaveBeenCalledWith('enrollment-1', tx);
    expect(result.data).not.toHaveProperty('institutionId');
    // Executor calls on the transaction come only from the outbox helpers:
    // insert (before publish), then mark published (after publish).
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0] as {
      name: string;
      payload: Record<string, unknown>;
    };
    expect(event.name).toBe('enrollment.created');
    // Events no longer carry the school: the key is absent, not undefined.
    expect(event).not.toHaveProperty('institutionId');
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty(
      'institutionId'
    );
    expect(repository.findStudent).toHaveBeenCalledWith('student-1');
    expect(repository.findAcademicPeriod).toHaveBeenCalledWith('period-1');
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
    const service = new EnrollmentsService(repository as never, {} as never, {
      publish,
    } as never);

    // The publish failure escapes the repository transaction, which is what
    // makes the real drizzle transaction roll the staged rows back.
    await expect(
      service.createEnrollment({
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
    const service = new EnrollmentsService(repository as never, {} as never);

    const result = await service.createEnrollment({
      studentId: 'student-1',
      academicPeriodId: 'period-1',
      status: 'active',
    });

    expect(result.data.id).toBe('enrollment-1');
    // Outbox insert only — no publish, no published_at mark; the background
    // outbox publisher picks the row up later.
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });
  describe('without a school scope', () => {
    const record = {
      id: 'enrollment-1',
      studentId: 'student-1',
      academicPeriodId: 'period-1',
      classroomId: null,
      status: 'active',
      promotionStatus: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
    };
    const actor = { userId: 'u1', role: 'teacher' } as never;

    it('lists with the per-caller scope and no school argument', async () => {
      const repository = {
        list: jest.fn().mockResolvedValue({ items: [record] }),
      };
      const access = {
        resolveReadableStudents: jest
          .fn()
          .mockResolvedValue({ all: false, studentIds: [] }),
      };
      const service = new EnrollmentsService(
        repository as never,
        access as never
      );

      const result = await service.listEnrollments({
        actor,
        limit: 25,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const call = repository.list.mock.calls[0][0];
      expect(call).not.toHaveProperty('institutionId');
      // An empty scope is passed through as [] (never widened to undefined).
      expect(call.studentIds).toEqual([]);
      expect(result.data[0]).not.toHaveProperty('institutionId');
    });

    it('reads, updates, deletes and evaluates by enrollment id only', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue(record),
        findClassroom: jest.fn().mockResolvedValue({ id: 'room-1' }),
        update: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
        countGrades: jest.fn().mockResolvedValue(0),
        countAttendance: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
        getEnrollmentAverage: jest
          .fn()
          .mockResolvedValue({ average: 4, gradeCount: 2 }),
      };
      const access = { assertCanReadEnrollment: jest.fn() };
      const service = new EnrollmentsService(
        repository as never,
        access as never
      );

      const got = await service.getEnrollment('enrollment-1', actor);
      expect(got.data).not.toHaveProperty('institutionId');
      expect(repository.findById).toHaveBeenLastCalledWith('enrollment-1');

      await service.updateEnrollment({
        enrollmentId: 'enrollment-1',
        classroomId: 'room-1',
      });
      expect(repository.findClassroom).toHaveBeenCalledWith('room-1');
      expect(repository.update).toHaveBeenCalledWith({
        enrollmentId: 'enrollment-1',
        classroomId: 'room-1',
        status: undefined,
        promotionStatus: undefined,
      });

      await service.deleteEnrollment('enrollment-1');
      expect(repository.countGrades).toHaveBeenCalledWith('enrollment-1');
      expect(repository.countAttendance).toHaveBeenCalledWith('enrollment-1');
      expect(repository.delete).toHaveBeenCalledWith('enrollment-1');

      const promotion = await service.evaluatePromotion('enrollment-1');
      expect(repository.getEnrollmentAverage).toHaveBeenCalledWith(
        'enrollment-1'
      );
      expect(promotion.data.enrollmentId).toBe('enrollment-1');
    });

    it('still refuses to delete an enrollment with grades (409)', async () => {
      const repository = {
        findById: jest.fn().mockResolvedValue(record),
        countGrades: jest.fn().mockResolvedValue(1),
        countAttendance: jest.fn().mockResolvedValue(0),
      };
      const service = new EnrollmentsService(repository as never, {} as never);

      await expect(service.deleteEnrollment('enrollment-1')).rejects.toEqual(
        expect.objectContaining({ statusCode: 409 })
      );
    });
  });
});
