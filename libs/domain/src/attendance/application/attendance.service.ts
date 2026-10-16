import type { EventBus } from '@edunic/source/events';
import { createAttendanceMarkedEvent } from '@edunic/source/domain/events';
import {
  buildCursorPage,
  insertOutboxEvent,
  markOutboxPublished,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
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

  async listAttendance(
    input: ListAttendanceQuery & {
      institutionId: string;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.attendanceRepository.list({
      ...input,
      date: input.date?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (attendance) => attendance.date,
        id: (attendance) => attendance.id,
      },
      result.total
    );

    return {
      data: page.data.map((attendance) =>
        this.toAttendanceResponse(attendance)
      ),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
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

    // P2-R6 / D2: the attendance row, its outbox event and the publish
    // outcome commit together — a failed publish rolls the rows back.
    const attendance = await this.attendanceRepository.transaction(
      async (tx) => {
        const createdAttendance = await this.attendanceRepository.create(
          {
            institutionId: input.institutionId,
            enrollmentId: input.enrollmentId,
            date: input.date.trim(),
            status: input.status,
          },
          tx
        );

        const record = await this.attendanceRepository.findById(
          input.institutionId,
          createdAttendance.id,
          tx
        );

        if (!record) {
          throw new AttendanceServiceError('Attendance record not found', 404);
        }

        const event = createAttendanceMarkedEvent({
          institutionId: input.institutionId,
          payload: {
            attendanceId: record.id,
            enrollmentId: record.enrollmentId,
            date: record.date,
            status: record.status,
          },
        });

        await insertOutboxEvent(tx, event);

        if (this.eventBus) {
          await this.eventBus.publish(event);
          await markOutboxPublished(tx, event.id);
        }

        return record;
      }
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
