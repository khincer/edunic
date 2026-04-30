import {
  StudentsService,
  StudentsServiceError,
} from '../../src/modules/students/application/students.service.js';

describe('StudentsService', () => {
  it('returns 409 when deleting a student with enrollments', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'student-1',
        institutionId: 'inst-1',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: null,
        createdAt: null,
      }),
      countEnrollments: jest.fn().mockResolvedValue(1),
      delete: jest.fn(),
    };

    const service = new StudentsService(repository as never);

    await expect(service.deleteStudent('inst-1', 'student-1')).rejects.toEqual(
      expect.objectContaining<Partial<StudentsServiceError>>({
        message: 'Student cannot be deleted while enrollments exist',
        statusCode: 409,
      })
    );
  });
});
