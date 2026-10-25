import {
  ClassroomsService,
  ClassroomsServiceError,
} from '@edunic/source/domain/classrooms';

describe('ClassroomsService', () => {
  it('returns 409 when a duplicate grade and section already exist', async () => {
    const repository = {
      findByGradeAndSection: jest.fn().mockResolvedValue({ id: 'classroom-1' }),
    };

    const service = new ClassroomsService(repository as never);

    await expect(
      service.createClassroom({
        gradeLevel: 5,
        section: 'A',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClassroomsServiceError>>({
        message: 'Classroom already exists for this grade and section',
        statusCode: 409,
      })
    );
    expect(repository.findByGradeAndSection).toHaveBeenCalledWith(5, 'A');
  });

  it('returns 409 when deleting a classroom with enrollments', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'classroom-1',
        gradeLevel: 5,
        section: 'A',
      }),
      countEnrollments: jest.fn().mockResolvedValue(1),
    };

    const service = new ClassroomsService(repository as never);

    await expect(
      service.deleteClassroom('classroom-1')
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClassroomsServiceError>>({
        message: 'Classroom cannot be deleted while enrollments exist',
        statusCode: 409,
      })
    );
  });

  it('looks classrooms up without a school and returns no institutionId', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'classroom-1',
        gradeLevel: 5,
        section: 'A',
      }),
    };
    const service = new ClassroomsService(repository as never);

    const result = await service.getClassroom('classroom-1');

    expect(repository.findById).toHaveBeenCalledWith('classroom-1');
    expect(result.data).not.toHaveProperty('institutionId');
    expect(result.data.name).toBe('Grade 5 A');
  });
});
