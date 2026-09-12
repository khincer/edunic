import {
  AttendanceService,
  AttendanceServiceError,
} from '@edunic/source/domain/attendance';

describe('AttendanceService', () => {
  it('returns 404 when the enrollment does not exist', async () => {
    const repository = {
      findEnrollment: jest.fn().mockResolvedValue(null),
    };

    const service = new AttendanceService(repository as never);

    await expect(
      service.createAttendance({
        institutionId: 'inst-1',
        enrollmentId: 'enrollment-1',
        date: '2026-02-01T08:00:00.000Z',
        status: 'present',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AttendanceServiceError>>({
        message: 'Enrollment not found',
        statusCode: 404,
      })
    );
  });
});
