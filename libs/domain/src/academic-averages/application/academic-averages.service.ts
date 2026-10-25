import {
  computeAverage,
  buildSubjectAverages,
} from '@edunic/source/domain/shared';
import {
  AccessService,
  type ReadActor,
} from '@edunic/source/domain/authorization';
import {
  AcademicAveragesRepository,
  type StudentGradeRow,
} from '../infrastructure/academic-averages.repository.js';

export class AcademicAveragesServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AcademicAveragesServiceError';
  }
}

export class AcademicAveragesService {
  constructor(
    private readonly academicAveragesRepository: AcademicAveragesRepository,
    private readonly access: AccessService
  ) {}

  async getStudentAverages(input: {
    studentId: string;
    year: number;
    actor: ReadActor;
  }) {
    await this.access.assertCanReadStudent(input.actor, input.studentId);

    const student = await this.academicAveragesRepository.findStudent(input.studentId);

    if (!student) {
      throw new AcademicAveragesServiceError('Student not found', 404);
    }

    const grades = await this.academicAveragesRepository.listStudentGrades(
      input.studentId,
      input.year
    );

    return {
      data: {
        studentId: input.studentId,
        year: input.year,
        annualAverage: computeAverage(grades),
        annualSubjects: buildSubjectAverages(grades),
        termAverages: this.buildTermAverages(grades),
      },
    };
  }

  private buildTermAverages(grades: StudentGradeRow[]) {
    const periods = new Map<
      string,
      {
        academicPeriodId: string;
        term: number;
        rows: StudentGradeRow[];
      }
    >();

    for (const grade of grades) {
      const existing = periods.get(grade.academicPeriodId);

      if (existing) {
        existing.rows.push(grade);
        continue;
      }

      periods.set(grade.academicPeriodId, {
        academicPeriodId: grade.academicPeriodId,
        term: grade.term,
        rows: [grade],
      });
    }

    return Array.from(periods.values())
      .sort((left, right) => left.term - right.term)
      .map((period) => ({
        academicPeriodId: period.academicPeriodId,
        term: period.term,
        average: computeAverage(period.rows),
        subjects: buildSubjectAverages(period.rows),
      }));
  }
}
