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
  constructor(private readonly enrollmentsRepository: EnrollmentsRepository) {}

  async listEnrollments(input: ListEnrollmentsQuery & { institutionId: string }) {
    const result = await this.enrollmentsRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
    });

    return {
      data: result.items.map((enrollment) =>
        this.toEnrollmentResponse(enrollment)
      ),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async getEnrollment(institutionId: string, enrollmentId: string) {
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
      const createdEnrollment = await this.enrollmentsRepository.create({
        institutionId: input.institutionId,
        studentId: input.studentId,
        academicPeriodId: input.academicPeriodId,
        classroomId: input.classroomId ?? null,
        status: input.status,
        promotionStatus: input.promotionStatus ?? null,
      });

      const enrollment = await this.enrollmentsRepository.findById(
        input.institutionId,
        createdEnrollment.id
      );

      if (!enrollment) {
        throw new EnrollmentsServiceError('Enrollment not found', 404);
      }

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

    if (databaseError?.code === '23505') {
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
