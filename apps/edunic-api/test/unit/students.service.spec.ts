import {
  StudentsService,
  StudentsServiceError,
} from '@edunic/source/domain/students';

const studentRow = {
  id: 'student-1',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: null,
  createdAt: null,
};

describe('StudentsService', () => {
  it('returns 409 when deleting a student with enrollments', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(studentRow),
      countEnrollments: jest.fn().mockResolvedValue(1),
      delete: jest.fn(),
    };

    const service = new StudentsService(repository as never, {} as never);

    await expect(service.deleteStudent('student-1')).rejects.toEqual(
      expect.objectContaining<Partial<StudentsServiceError>>({
        message: 'Student cannot be deleted while enrollments exist',
        statusCode: 409,
      })
    );
    expect(repository.countEnrollments).toHaveBeenCalledWith('student-1');
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes a student without enrollments using only its id', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(studentRow),
      countEnrollments: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue(studentRow),
    };
    const service = new StudentsService(repository as never, {} as never);

    await expect(service.deleteStudent('student-1')).resolves.toEqual({
      data: { id: 'student-1', deleted: true },
    });
    expect(repository.findById).toHaveBeenCalledWith('student-1');
    expect(repository.delete).toHaveBeenCalledWith('student-1');
  });

  it('creates a student without a school and does not expose one', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue(studentRow),
    };
    const service = new StudentsService(repository as never, {} as never);

    const result = await service.createStudent({
      firstName: ' Jane ',
      lastName: ' Doe ',
    });

    expect(repository.create).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: null,
    });
    expect(result.data).toEqual({
      id: 'student-1',
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      dateOfBirth: null,
      createdAt: null,
    });
  });

  it('reads and updates a student by id alone', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(studentRow),
      update: jest.fn().mockResolvedValue({ ...studentRow, firstName: 'Ann' }),
    };
    const access = { assertCanReadStudent: jest.fn() };
    const service = new StudentsService(repository as never, access as never);
    const actor = { userId: 'u1', role: 'director' } as never;

    await service.getStudent('student-1', actor);
    expect(repository.findById).toHaveBeenLastCalledWith('student-1');

    const updated = await service.updateStudent({
      studentId: 'student-1',
      firstName: ' Ann ',
    });
    expect(repository.update).toHaveBeenCalledWith({
      studentId: 'student-1',
      firstName: 'Ann',
      lastName: undefined,
      dateOfBirth: undefined,
    });
    expect(updated.data.firstName).toBe('Ann');
  });
});
