import {
  ClassroomsService,
  ClassroomsServiceError,
} from '../../src/modules/classrooms/application/classrooms.service.js';

describe('ClassroomsService', () => {
  it('returns 409 when a duplicate grade and section already exist', async () => {
    const repository = {
      findByGradeAndSection: jest.fn().mockResolvedValue({ id: 'classroom-1' }),
    };

    const service = new ClassroomsService(repository as never);

    await expect(
      service.createClassroom({
        institutionId: 'inst-1',
        gradeLevel: 5,
        section: 'A',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClassroomsServiceError>>({
        message: 'Classroom already exists for this grade and section',
        statusCode: 409,
      })
    );
  });

  it('returns 409 when deleting a classroom with enrollments', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'classroom-1',
        institutionId: 'inst-1',
        gradeLevel: 5,
        section: 'A',
      }),
      countEnrollments: jest.fn().mockResolvedValue(1),
    };

    const service = new ClassroomsService(repository as never);

    await expect(
      service.deleteClassroom('inst-1', 'classroom-1')
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClassroomsServiceError>>({
        message: 'Classroom cannot be deleted while enrollments exist',
        statusCode: 409,
      })
    );
  });
});
