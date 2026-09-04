import {
  computeAverage,
  buildSubjectAverages,
} from '@edunic/source/domain/shared';
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
    private readonly academicAveragesRepository: AcademicAveragesRepository
  ) {}

  async getStudentAverages(input: {
    institutionId: string;
    studentId: string;
    year: number;
  }) {
    const student = await this.academicAveragesRepository.findStudent(
      input.institutionId,
      input.studentId
    );

    if (!student) {
      throw new AcademicAveragesServiceError('Student not found', 404);
    }

    const grades = await this.academicAveragesRepository.listStudentGrades(
      input.institutionId,
      input.studentId,
      input.year
    );

    return {
      data: {
        institutionId: input.institutionId,
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
