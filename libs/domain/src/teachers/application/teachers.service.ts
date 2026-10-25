import { hashPassword } from '@edunic/source/domain/auth';
import {
  TeachersRepository,
  type TeacherClassroomRecord,
  type TeacherRecord,
} from '../infrastructure/teachers.repository.js';
import type {
  AssignClassroomsBody,
  CreateTeacherBody,
  ListTeachersQuery,
} from '../schemas/teachers.schemas.js';

export class TeachersServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'TeachersServiceError';
  }
}

export class TeachersService {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async listTeachers(input: ListTeachersQuery = {}) {
    const teachers = await this.teachersRepository.list('teacher');

    const offset = input.offset ?? 0;
    const limit = input.limit ?? 25;

    return {
      data: teachers.slice(offset, offset + limit).map((teacher) =>
        this.toTeacherResponse(teacher)
      ),
      meta: {
        total: teachers.length,
        limit,
        offset,
      },
    };
  }

  async getTeacher(userId: string) {
    const teacher = await this.teachersRepository.findById(userId);

    if (!teacher) {
      throw new TeachersServiceError('Teacher not found', 404);
    }

    return {
      data: this.toTeacherResponse(teacher),
    };
  }

  async createTeacher(input: CreateTeacherBody) {
    const existing = await this.teachersRepository.findByEmail(input.email);

    if (existing) {
      throw new TeachersServiceError(
        'An account with this email already exists',
        409
      );
    }

    const created = await this.teachersRepository.createUser({
      email: input.email,
      passwordHash: hashPassword(input.password),
      role: input.role,
    });

    if (!created) {
      throw new TeachersServiceError(
        'An account with this email already exists',
        409
      );
    }

    if (input.classroomIds?.length) {
      await this.assignClassrooms(created.id, { classroomIds: input.classroomIds });
    }

    return {
      data: this.toTeacherResponse(created),
    };
  }

  async updateTeacherRole(userId: string, role: string) {
    const updated = await this.teachersRepository.updateRole(userId, role);

    if (!updated) {
      throw new TeachersServiceError('Teacher not found', 404);
    }

    return {
      data: this.toTeacherResponse(updated),
    };
  }

  async listTeacherClassrooms(userId: string) {
    const teacher = await this.teachersRepository.findById(userId);

    if (!teacher) {
      throw new TeachersServiceError('Teacher not found', 404);
    }

    const classrooms = await this.teachersRepository.listClassrooms(userId);

    return {
      data: classrooms.map((classroom) => this.toClassroomResponse(classroom)),
    };
  }

  async assignClassrooms(userId: string, input: AssignClassroomsBody) {
    const teacher = await this.teachersRepository.findById(userId);

    if (!teacher) {
      throw new TeachersServiceError('Teacher not found', 404);
    }

    for (const classroomId of input.classroomIds) {
      const classroom = await this.teachersRepository.classroomExists(classroomId);

      if (!classroom) {
        throw new TeachersServiceError('Classroom not found', 404);
      }
    }

    for (const classroomId of input.classroomIds) {
      await this.teachersRepository.assignClassroom(userId, classroomId);
    }

    return this.listTeacherClassrooms(userId);
  }

  async unassignClassroom(userId: string, classroomId: string) {
    const removed = await this.teachersRepository.unassignClassroom(
      userId,
      classroomId
    );

    if (!removed) {
      throw new TeachersServiceError(
        'The teacher is not assigned to that classroom',
        404
      );
    }

    return {
      data: {
        userId,
        classroomId,
        deleted: true,
      },
    };
  }

  private toTeacherResponse(teacher: TeacherRecord) {
    return {
      id: teacher.id,
      email: teacher.email,
      role: teacher.role,
      createdAt: teacher.createdAt,
    };
  }

  private toClassroomResponse(classroom: TeacherClassroomRecord) {
    return {
      id: classroom.classroomId,
      gradeLevel: classroom.gradeLevel,
      section: classroom.section,
    };
  }
}
