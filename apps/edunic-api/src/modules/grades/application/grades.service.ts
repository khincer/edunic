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
  constructor(private readonly gradesRepository: GradesRepository) {}

  async listGrades(input: ListGradesQuery & { institutionId: string }) {
    const result = await this.gradesRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
      subject: input.subject?.trim() || undefined,
    });

    return {
      data: result.items.map((grade) => this.toGradeResponse(grade)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
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

  async createGrade(input: CreateGradeBody & { institutionId: string }) {
    const enrollment = await this.gradesRepository.findEnrollment(
      input.institutionId,
      input.enrollmentId
    );

    if (!enrollment) {
      throw new GradesServiceError('Enrollment not found', 404);
    }

    const createdGrade = await this.gradesRepository.create({
      institutionId: input.institutionId,
      enrollmentId: input.enrollmentId,
      subject: input.subject.trim(),
      score: input.score,
    });

    const grade = await this.gradesRepository.findById(
      input.institutionId,
      createdGrade.id
    );

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    return {
      data: this.toGradeResponse(grade),
    };
  }

  async updateGrade(input: UpdateGradeBody & {
    institutionId: string;
    gradeId: string;
  }) {
    const existingGrade = await this.gradesRepository.findById(
      input.institutionId,
      input.gradeId
    );

    if (!existingGrade) {
      throw new GradesServiceError('Grade not found', 404);
    }

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

  async deleteGrade(institutionId: string, gradeId: string) {
    const grade = await this.gradesRepository.findById(institutionId, gradeId);

    if (!grade) {
      throw new GradesServiceError('Grade not found', 404);
    }

    await this.gradesRepository.delete(institutionId, gradeId);

    return {
      data: {
        id: gradeId,
        deleted: true,
      },
    };
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
