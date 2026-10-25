import type { EventBus } from '@edunic/source/events';
import {
  AccessService,
  type ReadActor,
} from '@edunic/source/domain/authorization';
import { createGradeSubmittedEvent } from '@edunic/source/domain/events';
import {
  buildCursorPage,
  insertOutboxEvent,
  markOutboxPublished,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateGradeBody,
  ListGradesQuery,
  UpdateGradeBody,
} from '../schemas/grade.schemas.js';
import {
  GradesRepository,
  type GradeRecord,
} from '../infrastructure/grades.repository.js';

export class GradesServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'GradesServiceError';
  }
}

export class GradesService {
  constructor(
    private readonly gradesRepository: GradesRepository,
    private readonly eventBus: EventBus | undefined,
    private readonly access: AccessService
  ) {}

  async listGrades(
    input: ListGradesQuery & {
      actor: ReadActor;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const { actor, ...query } = input;
    const readable = await this.access.resolveReadableStudents(actor);
    const result = await this.gradesRepository.list({
      ...query,
      studentIds: readable.all ? undefined : readable.studentIds,
      search: input.search?.trim() || undefined,
      subjectId: input.subjectId,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        // created_at is always set by defaultNow(); the column is typed nullable.
        sortKey: (grade) => grade.createdAt as Date,
        id: (grade) => grade.id,
      },
      result.total
    );

    return {
      data: page.data.map((grade) => this.toGradeResponse(grade)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getGrade(gradeId: string, actor: ReadActor) {
    const grade = await this.gradesRepository.findById(gradeId);

    await this.access.assertCanReadEnrollment(
      actor,
      grade?.enrollmentId ?? null
    );

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    return {
      data: this.toGradeResponse(grade),
    };
  }

  async createGrade(
    input: CreateGradeBody & {
      role: string;
      userId: string;
    }
  ) {
    const enrollment = await this.gradesRepository.findEnrollment(
      input.enrollmentId
    );

    if (!enrollment) {
      throw new GradesServiceError('Enrollment not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(input, input.enrollmentId);
    await this.assertTeacherOwnsSubject(input, input.subjectId);

    // P2-R6 / D2: the grade row, its outbox event and the publish outcome
    // commit together — a failed publish rolls the rows back.
    const grade = await this.gradesRepository.transaction(async (tx) => {
      const createdGrade = await this.gradesRepository.create(
        {
          enrollmentId: input.enrollmentId,
          subjectId: input.subjectId,
          topicId: input.topicId ?? null,
          score: input.score,
        },
        tx
      );

      const record = await this.gradesRepository.findById(createdGrade.id, tx);

      if (!record) {
        throw new GradesServiceError('Grade not found', 404);
      }

      const event = createGradeSubmittedEvent({
        payload: {
          gradeId: record.id,
          enrollmentId: record.enrollmentId,
          subject: record.subject,
          score: record.score,
        },
      });

      await insertOutboxEvent(tx, event);

      if (this.eventBus) {
        await this.eventBus.publish(event);
        await markOutboxPublished(tx, event.id);
      }

      return record;
    });

    return {
      data: this.toGradeResponse(grade),
    };
  }

  async updateGrade(input: UpdateGradeBody & {
    gradeId: string;
    role: string;
    userId: string;
  }) {
    const existingGrade = await this.gradesRepository.findById(
      input.gradeId
    );

    if (!existingGrade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(input, existingGrade.enrollmentId);

    // The materia of the grade: the one given, or the one the tema belongs
    // to, or the one the grade already has.
    const subjectId = await this.resolveSubjectId(input, existingGrade);
    await this.assertTeacherOwnsSubject(input, subjectId);

    // A grade whose materia changes loses its tema: a tema of the old materia
    // would point at two subjects at once.
    const subjectChanged = subjectId !== existingGrade.subjectId;
    const topicId = subjectChanged
      ? input.topicId ?? null
      : input.topicId === undefined
        ? undefined
        : input.topicId;

    const updatedGrade = await this.gradesRepository.update({
      gradeId: input.gradeId,
      subjectId,
      topicId,
      score: input.score,
    });

    if (!updatedGrade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    const grade = await this.gradesRepository.findById(
      input.gradeId
    );

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    return {
      data: this.toGradeResponse(grade),
    };
  }

  async deleteGrade(
    gradeId: string,
    actor: { role: string; userId: string }
  ) {
    const grade = await this.gradesRepository.findById(gradeId);

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(actor, grade.enrollmentId);

    await this.gradesRepository.delete(gradeId);

    return {
      data: {
        id: gradeId,
        deleted: true,
      },
    };
  }

  private async resolveSubjectId(
    input: { subjectId?: string; topicId?: string | null },
    existingGrade: { subjectId: string }
  ) {
    if (input.subjectId) {
      return input.subjectId;
    }

    if (input.topicId) {
      const topicSubjectId =
        await this.gradesRepository.findTopicSubjectId(input.topicId);

      if (!topicSubjectId) {
        throw new GradesServiceError('Topic not found', 404);
      }

      return topicSubjectId;
    }

    return existingGrade.subjectId;
  }

  // A teacher may only write the grades of the classrooms they are assigned
  // to; an admin may write any of them.
  private async assertTeacherOwnsEnrollment(
    actor: { role: string; userId: string },
    enrollmentId: string
  ) {
    if (actor.role !== 'teacher') {
      return;
    }

    await this.access.assertTeacherOwnsEnrollment(actor.userId, enrollmentId);
  }

  // A teacher may only grade the materias they teach; an admin may grade any.
  private async assertTeacherOwnsSubject(
    actor: { role: string; userId: string },
    subjectId: string
  ) {
    if (actor.role !== 'teacher') {
      return;
    }

    await this.access.assertTeacherOwnsSubject(actor.userId, subjectId);
  }

  private toGradeResponse(grade: GradeRecord) {
    return {
      id: grade.id,
      enrollmentId: grade.enrollmentId,
      subjectId: grade.subjectId,
      topicId: grade.topicId,
      subject: grade.subject,
      score: grade.score,
      createdAt: grade.createdAt,
    };
  }
}
