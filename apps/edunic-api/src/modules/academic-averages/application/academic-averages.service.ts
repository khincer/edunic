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

type AverageBucket = {
  total: number;
  count: number;
};

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
        annualAverage: this.computeAverage(grades),
        annualSubjects: this.buildSubjectAverages(grades),
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
        average: this.computeAverage(period.rows),
        subjects: this.buildSubjectAverages(period.rows),
      }));
  }

  private buildSubjectAverages(grades: StudentGradeRow[]) {
    const buckets = new Map<string, AverageBucket>();

    for (const grade of grades) {
      const bucket = buckets.get(grade.subject) ?? { total: 0, count: 0 };
      bucket.total += grade.score;
      bucket.count += 1;
      buckets.set(grade.subject, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([subject, bucket]) => ({
        subject,
        average: this.toRoundedAverage(bucket),
      }));
  }

  private computeAverage(grades: StudentGradeRow[]) {
    if (grades.length === 0) {
      return null;
    }

    const total = grades.reduce((sum, grade) => sum + grade.score, 0);
    return this.toRoundedAverage({ total, count: grades.length });
  }

  private toRoundedAverage(bucket: AverageBucket) {
    if (bucket.count === 0) {
      return null;
    }

    return Number((bucket.total / bucket.count).toFixed(2));
  }
}
