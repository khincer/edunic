import {
  StudentsService,
  StudentsServiceError,
  ageOn,
  composeFullName,
} from '@edunic/source/domain/students';

const studentRow = {
  id: 'student-1',
  firstName: 'Jane',
  secondName: null,
  firstLastName: 'Doe',
  secondLastName: 'Roe',
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
      secondName: '  ',
      firstLastName: ' Doe ',
      secondLastName: ' Roe ',
    });

    expect(repository.create).toHaveBeenCalledWith({
      firstName: 'Jane',
      secondName: null,
      firstLastName: 'Doe',
      secondLastName: 'Roe',
      dateOfBirth: null,
    });
    expect(result.data).toEqual({
      id: 'student-1',
      firstName: 'Jane',
      secondName: null,
      firstLastName: 'Doe',
      secondLastName: 'Roe',
      fullName: 'Jane Doe Roe',
      dateOfBirth: null,
      age: null,
      createdAt: null,
    });
  });

  it('reads and updates a student by id alone', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(studentRow),
      listContexts: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ ...studentRow, firstName: 'Ann' }),
    };
    const access = { assertCanReadStudent: jest.fn() };
    const service = new StudentsService(repository as never, access as never);
    const actor = { userId: 'u1', role: 'director' } as never;

    const read = await service.getStudent('student-1', actor);
    expect(repository.findById).toHaveBeenLastCalledWith('student-1');
    expect(read.data).toMatchObject({
      gradeLevel: null,
      section: null,
      classroomId: null,
      academicPeriodId: null,
      guardians: [],
    });

    const updated = await service.updateStudent({
      studentId: 'student-1',
      firstName: ' Ann ',
    });
    expect(repository.update).toHaveBeenCalledWith({
      studentId: 'student-1',
      firstName: 'Ann',
      secondName: undefined,
      firstLastName: undefined,
      secondLastName: undefined,
      dateOfBirth: undefined,
    });
    expect(updated.data.firstName).toBe('Ann');
  });
});

describe('composeFullName', () => {
  it('joins the parts with single spaces and skips empty ones', () => {
    expect(
      composeFullName({
        firstName: 'Ana',
        secondName: 'María',
        firstLastName: 'López',
        secondLastName: 'García',
      })
    ).toBe('Ana María López García');
    expect(
      composeFullName({
        firstName: 'Ana',
        secondName: '  ',
        firstLastName: 'López',
        secondLastName: null,
      })
    ).toBe('Ana López');
  });
});

describe('ageOn', () => {
  const today = new Date('2026-10-26T12:00:00.000Z');

  it('counts whole years, before and after the birthday', () => {
    expect(ageOn('2015-10-26', today)).toBe(11);
    expect(ageOn('2015-10-27', today)).toBe(10);
    expect(ageOn('2015-01-01', today)).toBe(11);
  });

  it('returns null without a usable date', () => {
    expect(ageOn(null, today)).toBeNull();
    expect(ageOn('10/26/2015', today)).toBeNull();
  });
});
