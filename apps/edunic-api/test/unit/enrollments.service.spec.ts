import {
  EnrollmentsService,
  EnrollmentsServiceError,
} from '../../src/modules/enrollments/application/enrollments.service.js';

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
});
