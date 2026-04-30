import {
  GradesService,
  GradesServiceError,
} from '../../src/modules/grades/application/grades.service.js';

describe('GradesService', () => {
  it('returns 404 when the enrollment does not exist', async () => {
    const repository = {
      findEnrollment: jest.fn().mockResolvedValue(null),
    };

    const service = new GradesService(repository as never);

    await expect(
      service.createGrade({
        institutionId: 'inst-1',
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
});
