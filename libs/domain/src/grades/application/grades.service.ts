import type { EventBus } from '@edunic/source/events';
import { AccessService } from '@edunic/source/domain/authorization';
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
      institutionId: string;
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.gradesRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
      subject: input.subject?.trim() || undefined,
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

  async getGrade(institutionId: string, gradeId: string) {
    const grade = await this.gradesRepository.findById(institutionId, gradeId);

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    return {
      data: this.toGradeResponse(grade),
    };
  }

  async createGrade(
    input: CreateGradeBody & {
      institutionId: string;
      role: string;
      userId: string;
    }
  ) {
    const enrollment = await this.gradesRepository.findEnrollment(
      input.institutionId,
      input.enrollmentId
    );

    if (!enrollment) {
      throw new GradesServiceError('Enrollment not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(input, input.enrollmentId);

    // P2-R6 / D2: the grade row, its outbox event and the publish outcome
    // commit together — a failed publish rolls the rows back.
    const grade = await this.gradesRepository.transaction(async (tx) => {
      const createdGrade = await this.gradesRepository.create(
        {
          institutionId: input.institutionId,
          enrollmentId: input.enrollmentId,
          subject: input.subject.trim(),
          score: input.score,
        },
        tx
      );

      const record = await this.gradesRepository.findById(
        input.institutionId,
        createdGrade.id,
        tx
      );

      if (!record) {
        throw new GradesServiceError('Grade not found', 404);
      }

      const event = createGradeSubmittedEvent({
        institutionId: input.institutionId,
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
    institutionId: string;
    gradeId: string;
    role: string;
    userId: string;
  }) {
    const existingGrade = await this.gradesRepository.findById(
      input.institutionId,
      input.gradeId
    );

    if (!existingGrade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(input, existingGrade.enrollmentId);

    const updatedGrade = await this.gradesRepository.update({
      institutionId: input.institutionId,
      gradeId: input.gradeId,
      subject: input.subject?.trim(),
      score: input.score,
    });

    if (!updatedGrade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    const grade = await this.gradesRepository.findById(
      input.institutionId,
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
    institutionId: string,
    gradeId: string,
    actor: { role: string; userId: string }
  ) {
    const grade = await this.gradesRepository.findById(institutionId, gradeId);

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    await this.assertTeacherOwnsEnrollment(actor, grade.enrollmentId);

    await this.gradesRepository.delete(institutionId, gradeId);

    return {
      data: {
        id: gradeId,
        deleted: true,
      },
    };
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

  private toGradeResponse(grade: GradeRecord) {
    return {
      id: grade.id,
      institutionId: grade.institutionId,
      enrollmentId: grade.enrollmentId,
      subject: grade.subject,
      score: grade.score,
      createdAt: grade.createdAt,
    };
  }
}
