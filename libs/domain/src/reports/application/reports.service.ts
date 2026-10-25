import {
  computeAverage,
  buildSubjectAverages,
} from '@edunic/source/domain/shared';
import {
  AccessService,
  isAdminRole,
} from '@edunic/source/domain/authorization';
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

export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly accessService: AccessService
  ) {}

  async getStudentAcademicSummary(input: {
    institutionId: string;
    studentId: string;
    year: number;
    actor: { role: string; userId: string };
  }) {
    await this.assertCanReadStudent(input.actor, input.studentId);

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
        annualAverage: computeAverage(grades),
        annualSubjects: buildSubjectAverages(grades),
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

  // A student's summary is private: the administration reads any student, a
  // teacher the students of their classrooms, a parent their own children.
  // The check runs before the lookup so a refusal does not reveal whether the
  // student exists.
  private async assertCanReadStudent(
    actor: { role: string; userId: string },
    studentId: string
  ) {
    if (isAdminRole(actor.role)) {
      return;
    }

    if (actor.role === 'teacher') {
      await this.accessService.assertTeacherTeachesStudent(
        actor.userId,
        studentId
      );
      return;
    }

    if (actor.role === 'parent') {
      await this.accessService.assertParentOwnsStudent(actor.userId, studentId);
      return;
    }

    throw new ReportsServiceError('Forbidden', 403);
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
        average: computeAverage(periodGrades),
        promotionStatus: enrollment.promotionStatus,
        subjects: buildSubjectAverages(periodGrades),
      };
    });
  }
}
