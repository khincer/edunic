import {
  GuardiansService,
  GuardiansServiceError,
} from '@edunic/source/domain/guardians';

const guardianRow = {
  id: 'guardian-1',
  name: 'Maria',
  phone: null,
  email: null,
};
const studentRow = { id: 'student-1', firstName: 'Jane', lastName: 'Doe' };

describe('GuardiansService', () => {
  it('creates a guardian without a school and does not expose one', async () => {
    const repository = { create: jest.fn().mockResolvedValue(guardianRow) };
    const service = new GuardiansService(repository as never, {} as never);

    const result = await service.createGuardian({ name: ' Maria ' });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Maria',
      phone: null,
      email: null,
    });
    expect(result.data).toEqual({
      id: 'guardian-1',
      name: 'Maria',
      phone: null,
      email: null,
    });
  });

  it('answers 409 when the guardian is already linked to the student', async () => {
    const repository = {
      findStudentById: jest.fn().mockResolvedValue(studentRow),
      findById: jest.fn().mockResolvedValue(guardianRow),
      findStudentGuardianLink: jest.fn().mockResolvedValue(guardianRow),
      addGuardianToStudent: jest.fn(),
    };
    const service = new GuardiansService(repository as never, {} as never);

    await expect(
      service.linkGuardianToStudent('student-1', 'guardian-1')
    ).rejects.toEqual(
      expect.objectContaining<Partial<GuardiansServiceError>>({
        message: 'Guardian is already linked to this student',
        statusCode: 409,
      })
    );
    expect(repository.findStudentGuardianLink).toHaveBeenCalledWith(
      'student-1',
      'guardian-1'
    );
    expect(repository.addGuardianToStudent).not.toHaveBeenCalled();
  });

  it('links and unlinks using student and guardian ids only', async () => {
    const repository = {
      findStudentById: jest.fn().mockResolvedValue(studentRow),
      findById: jest.fn().mockResolvedValue(guardianRow),
      findStudentGuardianLink: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(guardianRow),
      addGuardianToStudent: jest.fn(),
      removeGuardianFromStudent: jest.fn(),
    };
    const service = new GuardiansService(repository as never, {} as never);

    const linked = await service.linkGuardianToStudent(
      'student-1',
      'guardian-1'
    );
    expect(repository.addGuardianToStudent).toHaveBeenCalledWith(
      'student-1',
      'guardian-1'
    );
    expect(linked.data.guardian).toEqual({
      id: 'guardian-1',
      name: 'Maria',
      phone: null,
      email: null,
    });

    await service.unlinkGuardianFromStudent('student-1', 'guardian-1');
    expect(repository.removeGuardianFromStudent).toHaveBeenCalledWith(
      'student-1',
      'guardian-1'
    );
  });

  it('refuses to delete a guardian that is still linked', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(guardianRow),
      countLinkedStudents: jest.fn().mockResolvedValue(2),
      delete: jest.fn(),
    };
    const service = new GuardiansService(repository as never, {} as never);

    await expect(service.deleteGuardian('guardian-1')).rejects.toEqual(
      expect.objectContaining<Partial<GuardiansServiceError>>({
        statusCode: 409,
      })
    );
    expect(repository.countLinkedStudents).toHaveBeenCalledWith('guardian-1');
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
