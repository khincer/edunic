import type {
  CreateStudentBody,
  ListStudentsQuery,
  UpdateStudentBody,
} from '../schemas/student.schemas.js';
import {
  StudentsRepository,
  type StudentRecord,
} from '../infrastructure/students.repository.js';

export class StudentsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'StudentsServiceError';
  }
}

export class StudentsService {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async listStudents(input: ListStudentsQuery & { institutionId: string }) {
    const result = await this.studentsRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
    });

    return {
      data: result.items.map((student) => this.toStudentResponse(student)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async getStudent(institutionId: string, studentId: string) {
    const student = await this.studentsRepository.findById(
      institutionId,
      studentId
    );

    if (!student) {
      throw new StudentsServiceError('Student not found', 404);
    }

    return {
      data: this.toStudentResponse(student),
    };
  }

  async createStudent(input: CreateStudentBody & { institutionId: string }) {
    const student = await this.studentsRepository.create({
      institutionId: input.institutionId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth?.trim() || null,
    });

    return {
      data: this.toStudentResponse(student),
    };
  }

  async updateStudent(input: UpdateStudentBody & {
    institutionId: string;
    studentId: string;
  }) {
    const existingStudent = await this.studentsRepository.findById(
      input.institutionId,
      input.studentId
    );

    if (!existingStudent) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const updatedStudent = await this.studentsRepository.update({
      institutionId: input.institutionId,
      studentId: input.studentId,
      firstName: input.firstName?.trim(),
      lastName: input.lastName?.trim(),
      dateOfBirth:
        input.dateOfBirth === undefined
          ? undefined
          : input.dateOfBirth.trim() || null,
    });

    if (!updatedStudent) {
      throw new StudentsServiceError('Student not found', 404);
    }

    return {
      data: this.toStudentResponse(updatedStudent),
    };
  }

  async deleteStudent(institutionId: string, studentId: string) {
    const student = await this.studentsRepository.findById(
      institutionId,
      studentId
    );

    if (!student) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const enrollmentCount = await this.studentsRepository.countEnrollments(
      institutionId,
      studentId
    );

    if (enrollmentCount > 0) {
      throw new StudentsServiceError(
        'Student cannot be deleted while enrollments exist',
        409
      );
    }

    await this.studentsRepository.delete(institutionId, studentId);

    return {
      data: {
        id: studentId,
        deleted: true,
      },
    };
  }

  private toStudentResponse(student: StudentRecord) {
    return {
      id: student.id,
      institutionId: student.institutionId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      dateOfBirth: student.dateOfBirth,
      createdAt: student.createdAt,
    };
  }
}
