import type { EventBus } from '@edunic/source/events';
import { AccessService } from '@edunic/source/domain/authorization';
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
    private readonly eventBus: EventBus | undefined,
    private readonly access: AccessService
  ) {}

  async listAttendance(
    input: ListAttendanceQuery & {
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

  async getAttendance(attendanceId: string) {
    const attendance = await this.attendanceRepository.findById(attendanceId);

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    return {
      data: this.toAttendanceResponse(attendance),
    };
  }

  async createAttendance(
    input: CreateAttendanceBody & {
      role: string;
      userId: string;
    }
  ) {
    const enrollment = await this.attendanceRepository.findEnrollment(
      input.enrollmentId
    );

    if (!enrollment) {
      throw new AttendanceServiceError('Enrollment not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(input, input.enrollmentId);

    // P2-R6 / D2: the attendance row, its outbox event and the publish
    // outcome commit together — a failed publish rolls the rows back.
    const attendance = await this.attendanceRepository.transaction(
      async (tx) => {
        const createdAttendance = await this.attendanceRepository.create(
          {
            enrollmentId: input.enrollmentId,
            date: input.date.trim(),
            status: input.status,
          },
          tx
        );

        const record = await this.attendanceRepository.findById(
          createdAttendance.id,
          tx
        );

        if (!record) {
          throw new AttendanceServiceError('Attendance record not found', 404);
        }

        const event = createAttendanceMarkedEvent({
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
      attendanceId: string;
      role: string;
      userId: string;
    }
  ) {
    const existingAttendance = await this.attendanceRepository.findById(
      input.attendanceId
    );

    if (!existingAttendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(
      input,
      existingAttendance.enrollmentId
    );

    const updatedAttendance = await this.attendanceRepository.update({
      attendanceId: input.attendanceId,
      date: input.date?.trim(),
      status: input.status,
    });

    if (!updatedAttendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    const attendance = await this.attendanceRepository.findById(
      input.attendanceId
    );

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    return {
      data: this.toAttendanceResponse(attendance),
    };
  }

  async deleteAttendance(
    attendanceId: string,
    actor: { role: string; userId: string }
  ) {
    const attendance = await this.attendanceRepository.findById(attendanceId);

    if (!attendance) {
      throw new AttendanceServiceError('Attendance record not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(actor, attendance.enrollmentId);

    await this.attendanceRepository.delete(attendanceId);

    return {
      data: {
        id: attendanceId,
        deleted: true,
      },
    };
  }

  // A teacher may only write the attendance of the classrooms they are
  // assigned to; an admin may write any of them.
  private async assertTeacherOwnsEnrollment(
    actor: { role: string; userId: string },
    enrollmentId: string
  ) {
    if (actor.role !== 'teacher') {
      return;
    }

    await this.access.assertTeacherOwnsEnrollment(actor.userId, enrollmentId);
  }

  private toAttendanceResponse(attendance: AttendanceRecord) {
    return {
      id: attendance.id,
      enrollmentId: attendance.enrollmentId,
      date: attendance.date,
      status: attendance.status,
      createdAt: attendance.createdAt,
    };
  }
}
