import {
  GradesService,
  GradesServiceError,
} from '@edunic/source/domain/grades';

// The teacher scoping check is exercised in the integration specs; here
// the service only needs an access service that does not object.
const access = {
  assertTeacherOwnsEnrollment: jest.fn().mockResolvedValue(undefined),
} as never;


describe('GradesService', () => {
  it('returns 404 when the enrollment does not exist', async () => {
    const repository = {
      findEnrollment: jest.fn().mockResolvedValue(null),
    };

    const service = new GradesService(repository as never, undefined, access);

    await expect(
      service.createGrade({
        institutionId: 'inst-1',
      role: 'admin',
      userId: 'user-1',
        enrollmentId: 'enrollment-1',
        subject: 'Science',
        score: 90,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<GradesServiceError>>({
        message: 'Enrollment not found',
        statusCode: 404,
      })
    );
  });

  const gradeRecord = {
    id: 'grade-1',
    institutionId: 'inst-1',
    enrollmentId: 'enrollment-1',
    subject: 'Science',
    score: 90,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  function createRepositoryMock(tx: { execute: jest.Mock }) {
    return {
      findEnrollment: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
      create: jest.fn().mockResolvedValue({ id: 'grade-1' }),
      findById: jest.fn().mockResolvedValue(gradeRecord),
    };
  }

  it('creates the grade and the outbox event inside one repository transaction', async () => {
    const tx = { execute: jest.fn() };
    const repository = createRepositoryMock(tx);
    const publish = jest.fn().mockResolvedValue(undefined);
    const service = new GradesService(repository as never, {
      publish,
    } as never);

    const result = await service.createGrade({
      institutionId: 'inst-1',
      role: 'admin',
      userId: 'user-1',
      enrollmentId: 'enrollment-1',
      subject: 'Science',
      score: 90,
    });

    expect(result.data).toEqual(
      expect.objectContaining({ id: 'grade-1', subject: 'Science' })
    );
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: 'enrollment-1', score: 90 }),
      tx
    );
    expect(repository.findById).toHaveBeenCalledWith('inst-1', 'grade-1', tx);
    // Executor calls on the transaction come only from the outbox helpers:
    // insert (before publish), then mark published (after publish).
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(1);
    const event = publish.mock.calls[0][0] as {
      name: string;
      payload: Record<string, unknown>;
    };
    expect(event.name).toBe('grade.submitted');
    expect(event.payload).toEqual(
      expect.objectContaining({ gradeId: 'grade-1', score: 90 })
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
    const service = new GradesService(repository as never, {
      publish,
    } as never);

    await expect(
      service.createGrade({
        institutionId: 'inst-1',
      role: 'admin',
      userId: 'user-1',
        enrollmentId: 'enrollment-1',
        subject: 'Science',
        score: 90,
      })
    ).rejects.toThrow('event bus down (injected)');
    expect(repository.create).toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it('leaves the outbox row unpublished for the publisher when no bus is attached', async () => {
    const tx = { execute: jest.fn() };
    const repository = createRepositoryMock(tx);
    const service = new GradesService(repository as never, undefined, access);

    const result = await service.createGrade({
      institutionId: 'inst-1',
      role: 'admin',
      userId: 'user-1',
      enrollmentId: 'enrollment-1',
      subject: 'Science',
      score: 90,
    });

    expect(result.data.id).toBe('grade-1');
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });
});
