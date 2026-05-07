import type { EventBus } from '../../../events.js';
import { createAttendanceMarkedEvent } from '../../../domain-events.js';
import type {
  CreateAttendanceBody,
  ListAttendanceQuery,
  UpdateAttendanceBody,
} from '../schemas/attendance.schemas.js';
import {
  AttendanceRepository,
  type AttendanceRecord,
} from '../infrastructure/attendance.repository.js';

export class AttendanceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AttendanceServiceError';
  }
}

export class AttendanceService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly eventBus?: EventBus
  ) {}

  async listAttendance(input: ListAttendanceQuery & { institutionId: string }) {
    const result = await this.attendanceRepository.list({
      ...input,
      date: input.date?.trim() || undefined,
    });

    return {
      data: result.items.map((attendance) =>
        this.toAttendanceResponse(attendance)
      ),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async getAttendance(institutionId: string, attendanceId: string) {
    const attendance = await this.attendanceRepository.findById(
      institutionId,
      attendanceId
    );

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    return {
      data: this.toAttendanceResponse(attendance),
    };
  }

  async createAttendance(
    input: CreateAttendanceBody & { institutionId: string }
  ) {
    const enrollment = await this.attendanceRepository.findEnrollment(
      input.institutionId,
      input.enrollmentId
    );

    if (!enrollment) {
      throw new AttendanceServiceError('Enrollment not found', 404);
    }

    const createdAttendance = await this.attendanceRepository.create({
      institutionId: input.institutionId,
      enrollmentId: input.enrollmentId,
      date: input.date.trim(),
      status: input.status,
    });

    const attendance = await this.attendanceRepository.findById(
      input.institutionId,
      createdAttendance.id
    );

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    await this.eventBus?.publish(
      createAttendanceMarkedEvent({
        institutionId: input.institutionId,
        payload: {
          attendanceId: attendance.id,
          enrollmentId: attendance.enrollmentId,
          date: attendance.date,
          status: attendance.status,
        },
      })
    );

    return {
      data: this.toAttendanceResponse(attendance),
    };
  }

  async updateAttendance(
    input: UpdateAttendanceBody & {
      institutionId: string;
      attendanceId: string;
    }
  ) {
    const existingAttendance = await this.attendanceRepository.findById(
      input.institutionId,
      input.attendanceId
    );

    if (!existingAttendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    const updatedAttendance = await this.attendanceRepository.update({
      institutionId: input.institutionId,
      attendanceId: input.attendanceId,
      date: input.date?.trim(),
      status: input.status,
    });

    if (!updatedAttendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    const attendance = await this.attendanceRepository.findById(
      input.institutionId,
      input.attendanceId
    );

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    return {
      data: this.toAttendanceResponse(attendance),
    };
  }

  async deleteAttendance(institutionId: string, attendanceId: string) {
    const attendance = await this.attendanceRepository.findById(
      institutionId,
      attendanceId
    );

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    await this.attendanceRepository.delete(institutionId, attendanceId);

    return {
      data: {
        id: attendanceId,
        deleted: true,
      },
    };
  }

  private toAttendanceResponse(attendance: AttendanceRecord) {
    return {
      id: attendance.id,
      institutionId: attendance.institutionId,
      enrollmentId: attendance.enrollmentId,
      date: attendance.date,
      status: attendance.status,
      createdAt: attendance.createdAt,
    };
  }
}
