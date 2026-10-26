import {
  computeAverage,
  buildCursorPage,
  buildSubjectAverages,
  toCsv,
} from '@edunic/source/domain/shared';
import {
  AccessService,
  isAdminRole,
  type ReadActor,
} from '@edunic/source/domain/authorization';
import type {
  ExportGradesCsvQuery,
  ListReportHistoryQuery,
} from '../schemas/reports.schemas.js';
import {
  ReportsRepository,
  type ReportHistoryRecord,
  type StudentReportEnrollmentRow,
  type StudentReportGradeRow,
} from '../infrastructure/reports.repository.js';

type StudentAcademicSummary = Awaited<
  ReturnType<ReportsService['getStudentAcademicSummary']>
>['data'];

export type AcademicSummaryPdfRenderer = {
  renderStudentAcademicSummaryPdf(summary: StudentAcademicSummary): Promise<Buffer>;
};

// The report_history.report_type of each export format.
export const REPORT_TYPES = {
  academicSummaryPdf: 'academic_summary_pdf',
  gradesCsv: 'grades_csv',
} as const;

export const GRADES_CSV_HEADER = [
  'student_id',
  'student_name',
  'grade_level',
  'section',
  'year',
  'term',
  'subject',
  'score',
];

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
    private readonly accessService: AccessService,
    private readonly pdfRenderer?: AcademicSummaryPdfRenderer
  ) {}

  // REP-03: an export is recorded only once the PDF exists, so a refused or
  // failed export leaves no history row.
  async exportStudentAcademicSummaryPdf(input: {
    studentId: string;
    year: number;
    actor: ReadActor;
  }) {
    if (!this.pdfRenderer) {
      throw new ReportsServiceError('PDF export is not available', 503);
    }

    const summary = await this.getStudentAcademicSummary(input);
    const pdf = await this.pdfRenderer.renderStudentAcademicSummaryPdf(
      summary.data
    );

    await this.reportsRepository.recordExport({
      studentId: input.studentId,
      year: input.year,
      reportType: REPORT_TYPES.academicSummaryPdf,
      createdByUserId: input.actor.userId,
    });

    return {
      pdf,
      filename: `student-academic-summary-${input.studentId}-${input.year}.pdf`,
    };
  }

  // REP-02: the grades of a year as CSV, for the students the actor may read:
  // the administration any student, a teacher the students of their
  // classrooms, a parent their own children. A named student or classroom
  // outside that scope is refused before anything is read. Every exported
  // student gets a report_history row (REP-03).
  async exportGradesCsv(input: ExportGradesCsvQuery & { actor: ReadActor }) {
    const { actor, ...query } = input;

    if (query.studentId) {
      await this.accessService.assertCanReadStudent(actor, query.studentId);
    }

    if (query.classroomId && actor.role === 'teacher') {
      await this.accessService.assertTeacherOwnsClassroom(
        actor.userId,
        query.classroomId
      );
    }

    const readable = await this.accessService.resolveReadableStudents(actor);
    const rows = await this.reportsRepository.listGradesForExport({
      ...query,
      studentIds: readable.all ? undefined : readable.studentIds,
    });

    const csv = toCsv(
      GRADES_CSV_HEADER,
      rows.map((row) => [
        row.studentId,
        `${row.firstName} ${row.lastName}`.trim(),
        row.gradeLevel,
        row.section,
        row.year,
        row.term,
        row.subject,
        row.score,
      ])
    );

    await this.reportsRepository.recordExports(
      [...new Set(rows.map((row) => row.studentId))].map((studentId) => ({
        studentId,
        year: query.year,
        reportType: REPORT_TYPES.gradesCsv,
        createdByUserId: actor.userId,
      }))
    );

    return { csv, filename: `grades-${query.year}.csv` };
  }

  // REP-03: the administration reads every export, a teacher the exports of
  // the students in their classrooms. Parents do not read the history.
  async listReportHistory(input: ListReportHistoryQuery & { actor: ReadActor }) {
    const { actor, ...query } = input;

    if (!isAdminRole(actor.role) && actor.role !== 'teacher') {
      throw new ReportsServiceError('Forbidden', 403);
    }

    const readable = await this.accessService.resolveReadableStudents(actor);
    const result = await this.reportsRepository.listHistory({
      ...query,
      studentIds: readable.all ? undefined : readable.studentIds,
    });

    const page = buildCursorPage(
      result.items,
      query,
      {
        sortKey: (row) => row.createdAt ?? new Date(0),
        id: (row) => row.id,
      },
      result.total
    );

    return {
      data: page.data.map((row) => this.toHistoryResponse(row)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getStudentAcademicSummary(input: {
    studentId: string;
    year: number;
    actor: { role: string; userId: string };
  }) {
    // The rule lives in AccessService; it runs before the lookup so a refusal
    // does not reveal whether the student exists.
    await this.accessService.assertCanReadStudent(input.actor, input.studentId);

    const student = await this.reportsRepository.findStudent(input.studentId);

    if (!student) {
      throw new ReportsServiceError('Student not found', 404);
    }

    const [grades, enrollments] = await Promise.all([
      this.reportsRepository.listStudentGrades(input.studentId, input.year),
      this.reportsRepository.listStudentEnrollments(input.studentId, input.year),
    ]);

    return {
      data: {
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

  private toHistoryResponse(row: ReportHistoryRecord) {
    return {
      id: row.id,
      studentId: row.studentId,
      studentName: `${row.studentFirstName} ${row.studentLastName}`.trim(),
      year: row.year,
      reportType: row.reportType,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
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
        average: computeAverage(periodGrades),
        promotionStatus: enrollment.promotionStatus,
        subjects: buildSubjectAverages(periodGrades),
      };
    });
  }
}
