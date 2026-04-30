import {
  AttendanceService,
  AttendanceServiceError,
} from '../../src/modules/attendance/application/attendance.service.js';

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
