import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import {
  AccessService,
  isAdminRole,
  type ReadActor,
} from '@edunic/source/domain/authorization';
import type {
  ClassroomActivityQuery,
  CreateClassroomBody,
  ListClassroomsQuery,
  UpdateClassroomBody,
} from '../schemas/classroom.schemas.js';
import {
  ClassroomsRepository,
  type ClassroomRecord,
} from '../infrastructure/classrooms.repository.js';
import {
  ClassroomActivityRepository,
  type ClassroomActivityTotalsRow,
} from '../infrastructure/classroom-activity.repository.js';

// The activity window when the caller names no start date.
export const DEFAULT_ACTIVITY_WINDOW_DAYS = 30;

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
  constructor(
    private readonly classroomsRepository: ClassroomsRepository,
    private readonly activity?: {
      repository: ClassroomActivityRepository;
      access: AccessService;
    }
  ) {}

  // ROLE-03 / ROLE-04: the administration reads any classroom's activity, a
  // teacher only their own. The ownership check runs before the lookup so a
  // teacher's refusal does not reveal whether the classroom exists.
  async getClassroomActivity(
    input: ClassroomActivityQuery & { classroomId: string; actor: ReadActor }
  ) {
    const { repository, access } = this.requireActivity();

    if (!isAdminRole(input.actor.role)) {
      if (input.actor.role !== 'teacher') {
        throw new ClassroomsServiceError('Forbidden', 403);
      }

      await access.assertTeacherOwnsClassroom(
        input.actor.userId,
        input.classroomId
      );
    }

    const since = this.resolveSince(input.since);
    const [totals] = await repository.listTotals({
      since,
      classroomId: input.classroomId,
    });

    if (!totals) {
      throw new ClassroomsServiceError('Classroom not found', 404);
    }

    const recent = await repository.listRecent({
      classroomId: input.classroomId,
      since,
      limit: input.limit,
    });

    return {
      data: {
        classroom: {
          id: totals.classroomId,
          gradeLevel: totals.gradeLevel,
          section: totals.section,
        },
        since,
        totals: {
          activeStudents: totals.activeStudents,
          gradesRecorded: totals.gradesRecorded,
          gradeAverage: totals.gradeAverage,
          attendanceMarked: totals.attendanceMarked,
          absences: totals.absences,
          lates: totals.lates,
          assignmentsCreated: totals.assignmentsCreated,
          eventsScheduled: totals.eventsScheduled,
        },
        recent,
      },
    };
  }

  // ROLE-04: one summary row per classroom, for the administration.
  async listClassroomActivity(input: { since?: string; actor: ReadActor }) {
    const { repository } = this.requireActivity();

    if (!isAdminRole(input.actor.role)) {
      throw new ClassroomsServiceError('Forbidden', 403);
    }

    const since = this.resolveSince(input.since);
    const rows = await repository.listTotals({ since });

    return {
      data: {
        since,
        classrooms: rows.map((row) => this.toActivitySummary(row)),
      },
    };
  }

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

  private requireActivity() {
    if (!this.activity) {
      throw new ClassroomsServiceError('Classroom activity is not available', 503);
    }

    return this.activity;
  }

  private resolveSince(since: string | undefined) {
    if (since) {
      return new Date(since);
    }

    return new Date(
      Date.now() - DEFAULT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
  }

  private toActivitySummary(row: ClassroomActivityTotalsRow) {
    return {
      classroomId: row.classroomId,
      gradeLevel: row.gradeLevel,
      section: row.section,
      teacherCount: row.teacherCount,
      activeStudents: row.activeStudents,
      gradesRecorded: row.gradesRecorded,
      attendanceMarked: row.attendanceMarked,
      absences: row.absences,
      assignmentsCreated: row.assignmentsCreated,
      eventsScheduled: row.eventsScheduled,
      lastActivityAt: row.lastActivityAt,
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
