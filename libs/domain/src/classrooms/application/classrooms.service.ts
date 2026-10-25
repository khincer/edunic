import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateClassroomBody,
  ListClassroomsQuery,
  UpdateClassroomBody,
} from '../schemas/classroom.schemas.js';
import {
  ClassroomsRepository,
  type ClassroomRecord,
} from '../infrastructure/classrooms.repository.js';

export class ClassroomsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ClassroomsServiceError';
  }
}

export class ClassroomsService {
  constructor(private readonly classroomsRepository: ClassroomsRepository) {}

  async listClassrooms(
    input: ListClassroomsQuery & {
      teacherUserId?: string;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.classroomsRepository.list({
      ...input,
      section: input.section?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (classroom) => classroom.gradeLevel,
        id: (classroom) => classroom.id,
      },
      result.total
    );

    return {
      data: page.data.map((classroom) => this.toClassroomResponse(classroom)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getClassroom(classroomId: string) {
    const classroom = await this.classroomsRepository.findById(classroomId);

    if (!classroom) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    return {
      data: this.toClassroomResponse(classroom),
    };
  }

  async createClassroom(input: CreateClassroomBody) {
    const section = input.section?.trim() || null;
    const existingClassroom =
      await this.classroomsRepository.findByGradeAndSection(input.gradeLevel, section);

    if (existingClassroom) {
      throw new ClassroomsServiceError(
        'Classroom already exists for this grade and section',
        409
      );
    }

    const createdClassroom = await this.classroomsRepository.create({
      gradeLevel: input.gradeLevel,
      section,
    });

    const classroom = await this.classroomsRepository.findById(createdClassroom.id);

    if (!classroom) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    return {
      data: this.toClassroomResponse(classroom),
    };
  }

  async updateClassroom(
    input: UpdateClassroomBody & { classroomId: string }
  ) {
    const existingClassroom = await this.classroomsRepository.findById(input.classroomId);

    if (!existingClassroom) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    const nextGradeLevel = input.gradeLevel ?? existingClassroom.gradeLevel;
    const nextSection =
      input.section === undefined
        ? existingClassroom.section
        : input.section?.trim() || null;

    const duplicateClassroom =
      await this.classroomsRepository.findByGradeAndSection(
        nextGradeLevel,
        nextSection,
        input.classroomId
      );

    if (duplicateClassroom) {
      throw new ClassroomsServiceError(
        'Classroom already exists for this grade and section',
        409
      );
    }

    const updatedClassroom = await this.classroomsRepository.update({
      classroomId: input.classroomId,
      gradeLevel: input.gradeLevel,
      section: input.section === undefined ? undefined : nextSection,
    });

    if (!updatedClassroom) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    const classroom = await this.classroomsRepository.findById(input.classroomId);

    if (!classroom) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    return {
      data: this.toClassroomResponse(classroom),
    };
  }

  async deleteClassroom(classroomId: string) {
    const classroom = await this.classroomsRepository.findById(classroomId);

    if (!classroom) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    const enrollmentCount = await this.classroomsRepository.countEnrollments(classroomId);

    if (enrollmentCount > 0) {
      throw new ClassroomsServiceError(
        'Classroom cannot be deleted while enrollments exist',
        409
      );
    }

    await this.classroomsRepository.delete(classroomId);

    return {
      data: {
        id: classroomId,
        deleted: true,
      },
    };
  }

  private toClassroomResponse(classroom: ClassroomRecord) {
    return {
      id: classroom.id,
      gradeLevel: classroom.gradeLevel,
      section: classroom.section,
      name: this.getClassroomName(classroom),
    };
  }

  private getClassroomName(classroom: ClassroomRecord) {
    return classroom.section
      ? `Grade ${classroom.gradeLevel} ${classroom.section}`
      : `Grade ${classroom.gradeLevel}`;
  }
}
