import {
  ReportsRepository,
  type StudentReportEnrollmentRow,
  type StudentReportGradeRow,
} from '../infrastructure/reports.repository.js';

export class ReportsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ReportsServiceError';
  }
}

type AverageBucket = {
  total: number;
  count: number;
};

export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getStudentAcademicSummary(input: {
    institutionId: string;
    studentId: string;
    year: number;
  }) {
    const student = await this.reportsRepository.findStudent(
      input.institutionId,
      input.studentId
    );

    if (!student) {
      throw new ReportsServiceError('Student not found', 404);
    }

    const [grades, enrollments] = await Promise.all([
      this.reportsRepository.listStudentGrades(
        input.institutionId,
        input.studentId,
        input.year
      ),
      this.reportsRepository.listStudentEnrollments(
        input.institutionId,
        input.studentId,
        input.year
      ),
    ]);

    return {
      data: {
        institutionId: input.institutionId,
        year: input.year,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          dateOfBirth: student.dateOfBirth,
        },
        annualAverage: this.computeAverage(grades),
        annualSubjects: this.buildSubjectAverages(grades),
        termAverages: this.buildTermAverages(grades, enrollments),
        enrollments: enrollments.map((enrollment) => ({
          enrollmentId: enrollment.enrollmentId,
          academicPeriodId: enrollment.academicPeriodId,
          term: enrollment.term,
          status: enrollment.enrollmentStatus,
          promotionStatus: enrollment.promotionStatus,
        })),
      },
    };
  }

  private buildTermAverages(
    grades: StudentReportGradeRow[],
    enrollments: StudentReportEnrollmentRow[]
  ) {
    const gradesByPeriod = new Map<string, StudentReportGradeRow[]>();

    for (const grade of grades) {
      const existing = gradesByPeriod.get(grade.academicPeriodId) ?? [];
      existing.push(grade);
      gradesByPeriod.set(grade.academicPeriodId, existing);
    }

    return enrollments.map((enrollment) => {
      const periodGrades = gradesByPeriod.get(enrollment.academicPeriodId) ?? [];

      return {
        academicPeriodId: enrollment.academicPeriodId,
        term: enrollment.term,
        average: this.computeAverage(periodGrades),
        promotionStatus: enrollment.promotionStatus,
        subjects: this.buildSubjectAverages(periodGrades),
      };
    });
  }

  private buildSubjectAverages(grades: StudentReportGradeRow[]) {
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

  private computeAverage(grades: StudentReportGradeRow[]) {
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
