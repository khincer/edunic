import type { EventBus } from '@edunic/source/events';
import type {
  AccessService,
  ReadActor,
} from '@edunic/source/domain/authorization';
import { createEnrollmentCreatedEvent } from '@edunic/source/domain/events';
import {
  PROMOTION_THRESHOLD,
  buildCursorPage,
  insertOutboxEvent,
  markOutboxPublished,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateEnrollmentBody,
  ListEnrollmentsQuery,
  UpdateEnrollmentBody,
} from '../schemas/enrollment.schemas.js';
import {
  EnrollmentsRepository,
  type EnrollmentRecord,
} from '../infrastructure/enrollments.repository.js';

type DatabaseError = Error & {
  code?: string;
  cause?: {
    code?: string;
  };
};

export class EnrollmentsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'EnrollmentsServiceError';
  }
}

export class EnrollmentsService {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly access: AccessService,
    private readonly eventBus?: EventBus
  ) {}

  async listEnrollments(
    input: ListEnrollmentsQuery & {
      institutionId: string;
      actor: ReadActor;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const { actor, ...query } = input;
    const readable = await this.access.resolveReadableStudents(actor);
    const result = await this.enrollmentsRepository.list({
      ...query,
      studentIds: readable.all ? undefined : readable.studentIds,
      search: input.search?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        // created_at is always set by defaultNow(); the column is typed nullable.
        sortKey: (enrollment) => enrollment.createdAt as Date,
        id: (enrollment) => enrollment.id,
      },
      result.total
    );

    return {
      data: page.data.map((enrollment) =>
        this.toEnrollmentResponse(enrollment)
      ),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getEnrollment(
    institutionId: string,
    enrollmentId: string,
    actor: ReadActor
  ) {
    await this.access.assertCanReadEnrollment(actor, enrollmentId);

    const enrollment = await this.enrollmentsRepository.findById(
      institutionId,
      enrollmentId
    );

    if (!enrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    return {
      data: this.toEnrollmentResponse(enrollment),
    };
  }

  async createEnrollment(input: CreateEnrollmentBody & { institutionId: string }) {
    await this.assertRelationsExist(
      input.institutionId,
      input.studentId,
      input.academicPeriodId,
      input.classroomId ?? undefined
    );

    try {
      // P2-R6 / D2: the enrollment row, its outbox event and the publish
      // outcome commit together — a failed publish rolls the rows back.
      const enrollment = await this.enrollmentsRepository.transaction(
        async (tx) => {
          const createdEnrollment = await this.enrollmentsRepository.create(
            {
              institutionId: input.institutionId,
              studentId: input.studentId,
              academicPeriodId: input.academicPeriodId,
              classroomId: input.classroomId ?? null,
              status: input.status,
              promotionStatus: input.promotionStatus ?? null,
            },
            tx
          );

          const record = await this.enrollmentsRepository.findById(
            input.institutionId,
            createdEnrollment.id,
            tx
          );

          if (!record) {
            throw new EnrollmentsServiceError('Enrollment not found', 404);
          }

          const event = createEnrollmentCreatedEvent({
            institutionId: input.institutionId,
            payload: {
              enrollmentId: record.id,
              studentId: record.studentId,
              academicPeriodId: record.academicPeriodId,
              classroomId: record.classroomId,
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
        data: this.toEnrollmentResponse(enrollment),
      };
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  async updateEnrollment(input: UpdateEnrollmentBody & {
    institutionId: string;
    enrollmentId: string;
  }) {
    const existingEnrollment = await this.enrollmentsRepository.findById(
      input.institutionId,
      input.enrollmentId
    );

    if (!existingEnrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    if (input.classroomId) {
      const classroom = await this.enrollmentsRepository.findClassroom(
        input.institutionId,
        input.classroomId
      );

      if (!classroom) {
        throw new EnrollmentsServiceError('Classroom not found', 404);
      }
    }

    const updatedEnrollment = await this.enrollmentsRepository.update({
      institutionId: input.institutionId,
      enrollmentId: input.enrollmentId,
      classroomId: input.classroomId,
      status: input.status,
      promotionStatus:
        input.promotionStatus === undefined
          ? undefined
          : input.promotionStatus?.trim() || null,
    });

    if (!updatedEnrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    const enrollment = await this.enrollmentsRepository.findById(
      input.institutionId,
      input.enrollmentId
    );

    if (!enrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    return {
      data: this.toEnrollmentResponse(enrollment),
    };
  }

  async deleteEnrollment(institutionId: string, enrollmentId: string) {
    const enrollment = await this.enrollmentsRepository.findById(
      institutionId,
      enrollmentId
    );

    if (!enrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    const [gradeCount, attendanceCount] = await Promise.all([
      this.enrollmentsRepository.countGrades(institutionId, enrollmentId),
      this.enrollmentsRepository.countAttendance(institutionId, enrollmentId),
    ]);

    if (gradeCount > 0 || attendanceCount > 0) {
      throw new EnrollmentsServiceError(
        'Enrollment cannot be deleted while grades or attendance records exist',
        409
      );
    }

    await this.enrollmentsRepository.delete(institutionId, enrollmentId);

    return {
      data: {
        id: enrollmentId,
        deleted: true,
      },
    };
  }

  async evaluatePromotion(institutionId: string, enrollmentId: string) {
    const enrollment = await this.enrollmentsRepository.findById(
      institutionId,
      enrollmentId
    );

    if (!enrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    const { average, gradeCount } =
      await this.enrollmentsRepository.getEnrollmentAverage(
        institutionId,
        enrollmentId
      );

    const promotionStatus =
      average === null
        ? 'pending'
        : average >= PROMOTION_THRESHOLD
          ? 'promoted'
          : 'retained';

    const updatedEnrollment = await this.enrollmentsRepository.update({
      institutionId,
      enrollmentId,
      promotionStatus,
    });

    if (!updatedEnrollment) {
      throw new EnrollmentsServiceError('Enrollment not found', 404);
    }

    return {
      data: {
        enrollmentId,
        academicPeriodId: enrollment.academicPeriodId,
        studentId: enrollment.studentId,
        gradeCount,
        average,
        threshold: PROMOTION_THRESHOLD,
        promotionStatus,
      },
    };
  }

  private async assertRelationsExist(
    institutionId: string,
    studentId: string,
    academicPeriodId: string,
    classroomId?: string
  ) {
    const [student, academicPeriod, classroom] = await Promise.all([
      this.enrollmentsRepository.findStudent(institutionId, studentId),
      this.enrollmentsRepository.findAcademicPeriod(
        institutionId,
        academicPeriodId
      ),
      classroomId
        ? this.enrollmentsRepository.findClassroom(institutionId, classroomId)
        : Promise.resolve(null),
    ]);

    if (!student) {
      throw new EnrollmentsServiceError('Student not found', 404);
    }

    if (!academicPeriod) {
      throw new EnrollmentsServiceError('Academic period not found', 404);
    }

    if (classroomId && !classroom) {
      throw new EnrollmentsServiceError('Classroom not found', 404);
    }
  }

  private handlePersistenceError(error: unknown): never {
    const databaseError = error as DatabaseError;

    if (databaseError?.code === '23505' || databaseError?.cause?.code === '23505') {
      throw new EnrollmentsServiceError(
        'Student is already enrolled in this academic period',
        409
      );
    }

    throw error;
  }

  private toEnrollmentResponse(enrollment: EnrollmentRecord) {
    return {
      id: enrollment.id,
      institutionId: enrollment.institutionId,
      studentId: enrollment.studentId,
      academicPeriodId: enrollment.academicPeriodId,
      classroomId: enrollment.classroomId,
      status: enrollment.status,
      promotionStatus: enrollment.promotionStatus,
      createdAt: enrollment.createdAt,
      student: {
        id: enrollment.studentId,
        firstName: enrollment.studentFirstName,
        lastName: enrollment.studentLastName,
        fullName: `${enrollment.studentFirstName} ${enrollment.studentLastName}`.trim(),
      },
    };
  }
}
