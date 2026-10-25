import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateStudentBody,
  ListStudentsQuery,
  UpdateStudentBody,
} from '../schemas/student.schemas.js';
import type {
  AccessService,
  ReadActor,
} from '@edunic/source/domain/authorization';
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
  constructor(
    private readonly studentsRepository: StudentsRepository,
    private readonly access: AccessService
  ) {}

  async listStudents(
    input: ListStudentsQuery & {
      actor: ReadActor;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const { actor, ...query } = input;
    const readable = await this.access.resolveReadableStudents(actor);
    const result = await this.studentsRepository.list({
      ...query,
      studentIds: readable.all ? undefined : readable.studentIds,
      search: input.search?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (student) => [student.lastName, student.firstName],
        id: (student) => student.id,
      },
      result.total
    );

    return {
      data: page.data.map((student) => this.toStudentResponse(student)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getStudent(studentId: string, actor: ReadActor) {
    await this.access.assertCanReadStudent(actor, studentId);

    const student = await this.studentsRepository.findById(studentId);

    if (!student) {
      throw new StudentsServiceError('Student not found', 404);
    }

    return {
      data: this.toStudentResponse(student),
    };
  }

  async createStudent(input: CreateStudentBody) {
    const student = await this.studentsRepository.create({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth?.trim() || null,
    });

    return {
      data: this.toStudentResponse(student),
    };
  }

  async updateStudent(input: UpdateStudentBody & { studentId: string }) {
    const existingStudent = await this.studentsRepository.findById(
      input.studentId
    );

    if (!existingStudent) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const updatedStudent = await this.studentsRepository.update({
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

  async deleteStudent(studentId: string) {
    const student = await this.studentsRepository.findById(studentId);

    if (!student) {
      throw new StudentsServiceError('Student not found', 404);
    }

    const enrollmentCount = await this.studentsRepository.countEnrollments(studentId);

    if (enrollmentCount > 0) {
      throw new StudentsServiceError(
        'Student cannot be deleted while enrollments exist',
        409
      );
    }

    await this.studentsRepository.delete(studentId);

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
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      dateOfBirth: student.dateOfBirth,
      createdAt: student.createdAt,
    };
  }
}
