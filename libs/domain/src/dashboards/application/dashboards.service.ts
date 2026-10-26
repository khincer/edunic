import { PaymentsRepository } from '@edunic/source/domain/payments';
import {
  DashboardsRepository,
  type ActivePeriodRow,
  type FeatureStatusRow,
  type GradeSubmissionSummaryRow,
  type RecentGradeRow,
  type StudentRiskRow,
} from '../infrastructure/dashboards.repository.js';

export class DashboardsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'DashboardsServiceError';
  }
}

export class DashboardsService {
  constructor(
    private readonly dashboardsRepository: DashboardsRepository,
    private readonly paymentsRepository: PaymentsRepository
  ) {}

  async getAdminDashboard(userId: string) {
    const context = await this.getInstitutionContext();
    const activePeriod = await this.dashboardsRepository.getActiveAcademicPeriod();

    const [
      studentCount,
      teacherCount,
      parentCount,
      guardianCount,
      activeEnrollmentCount,
      classroomCount,
      attendanceToday,
      gradeSubmission,
      featureFlags,
      extensions,
      recentNotifications,
      recentAuditActivity,
      upcomingAssignments,
      upcomingEvents,
      unreadMessages,
      recentMessages,
      reportHistory,
    ] = await Promise.all([
      this.dashboardsRepository.countStudents(),
      this.dashboardsRepository.countUsersByRole('teacher'),
      this.dashboardsRepository.countUsersByRole('parent'),
      this.dashboardsRepository.countGuardians(),
      this.dashboardsRepository.countActiveEnrollments(),
      this.dashboardsRepository.countClassrooms(),
      this.dashboardsRepository.getTodayAttendanceSummary(),
      this.dashboardsRepository.getGradeSubmissionSummary(activePeriod?.id ?? null),
      this.dashboardsRepository.listFeatureStatuses(),
      this.dashboardsRepository.listExtensionStatuses(),
      this.dashboardsRepository.listRecentNotifications({
        role: 'admin',
        userId,
      }),
      this.dashboardsRepository.listRecentAuditActivity(),
      this.dashboardsRepository.listUpcomingAssignments({
        role: 'admin',
      }),
      this.dashboardsRepository.listUpcomingEvents({
        role: 'admin',
      }),
      this.dashboardsRepository.countUnreadMessages(userId),
      this.dashboardsRepository.listRecentMessages(userId),
      this.dashboardsRepository.listReportHistory(),
    ]);

    return {
      data: {
        institution: context,
        activePeriod: this.toAcademicPeriod(activePeriod),
        counts: {
          students: studentCount,
          teachers: teacherCount,
          parents: parentCount,
          guardians: guardianCount,
          activeEnrollments: activeEnrollmentCount,
          classrooms: classroomCount,
        },
        attendanceToday,
        gradeSubmission: this.toGradeSubmission(gradeSubmission),
        modules: this.toModules(featureFlags, extensions),
        recentNotifications,
        recentAuditActivity,
        upcomingAssignments,
        upcomingEvents,
        unreadMessages,
        recentMessages,
        reportHistory,
      },
    };
  }

  async getTeacherDashboard(input: { userId: string; role: string }) {
    const { userId, role } = input;
    await this.getInstitutionContext();
    const teacherUserId = role === 'teacher' ? userId : undefined;

    const [
      classrooms,
      attendanceToday,
      activeEnrollmentCount,
      recentGrades,
      studentsAtRisk,
      recentNotifications,
      upcomingAssignments,
      upcomingEvents,
      unreadMessages,
      recentMessages,
    ] = await Promise.all([
      this.dashboardsRepository.listClassroomSnapshots(teacherUserId),
      this.dashboardsRepository.getTodayAttendanceSummary(teacherUserId),
      this.dashboardsRepository.countActiveEnrollments(teacherUserId),
      this.dashboardsRepository.listRecentGrades(5, teacherUserId),
      this.dashboardsRepository.listStudentsAtRisk(5, teacherUserId),
      this.dashboardsRepository.listRecentNotifications({
        role,
        userId,
      }),
      this.dashboardsRepository.listUpcomingAssignments({
        role,
        userId,
      }),
      this.dashboardsRepository.listUpcomingEvents({
        role,
        userId,
      }),
      this.dashboardsRepository.countUnreadMessages(userId),
      this.dashboardsRepository.listRecentMessages(userId),
    ]);

    return {
      data: {
        classrooms: classrooms.map((classroom) => ({
          ...classroom,
          rosterCount: Number(classroom.rosterCount),
          attendanceMarkedToday: Number(classroom.attendanceMarkedToday),
        })),
        attendanceToday,
        pendingAttendance: Math.max(
          activeEnrollmentCount - attendanceToday.marked,
          0
        ),
        activeEnrollmentCount,
        recentGrades: recentGrades.map((grade) => this.toRecentGrade(grade)),
        studentsAtRisk: studentsAtRisk.map((student) =>
          this.toStudentRisk(student)
        ),
        recentNotifications,
        upcomingAssignments,
        upcomingEvents,
        unreadMessages,
        recentMessages,
      },
    };
  }

  async getParentDashboard(userId: string) {
    await this.getInstitutionContext();

    const currentYear = new Date().getFullYear();
    const [
      students,
      recentNotifications,
      upcomingAssignments,
      upcomingEvents,
      unreadMessages,
      recentMessages,
    ] = await Promise.all([
      this.dashboardsRepository.listParentStudents(userId),
      this.dashboardsRepository.listRecentNotifications({
        role: 'parent',
        userId,
      }),
      this.dashboardsRepository.listUpcomingAssignments({
        role: 'parent',
        userId,
      }),
      this.dashboardsRepository.listUpcomingEvents({
        role: 'parent',
        userId,
      }),
      this.dashboardsRepository.countUnreadMessages(userId),
      this.dashboardsRepository.listRecentMessages(userId),
    ]);

    const studentSummaries = await Promise.all(
      students.map(async (student) => {
        const [average, attendance, recentGrades] = await Promise.all([
          this.dashboardsRepository.getStudentAverage(
            student.studentId,
            student.academicYear ?? currentYear
          ),
          this.dashboardsRepository.getStudentAttendanceSummary(student.studentId),
          this.dashboardsRepository.listStudentRecentGrades(student.studentId),
        ]);

        return {
          ...student,
          average,
          attendance,
          recentGrades: recentGrades.map((grade) => this.toRecentGrade(grade)),
          reportUrl: `/reports/students/${student.studentId}/academic-summary/pdf?year=${
            student.academicYear ?? currentYear
          }`,
        };
      })
    );

    // The payments of the children of this parent, and what each of them
    // still owes.
    const studentIds = studentSummaries.map((student) => student.studentId);
    const [payments, balances] = await Promise.all([
      this.paymentsRepository.list({
        studentIds,
        limit: 50,
        offset: 0,
      }),
      this.paymentsRepository.listStudentBalances(new Date()),
    ]);

    return {
      data: {
        students: studentSummaries,
        payments: payments.items.map((payment) => ({
          id: payment.id,
          studentId: payment.studentId,
          concept: payment.concept,
          amountCents: payment.amountCents,
          dueDate: payment.dueDate,
          status: payment.status,
          method: payment.method,
          receiptNumber: payment.receiptNumber,
        })),
        balances: balances
          .filter((balance) => studentIds.includes(balance.studentId))
          .map((balance) => ({
            studentId: balance.studentId,
            studentName: balance.studentName,
            billedCents: balance.billedCents,
            paidCents: balance.paidCents,
            outstandingCents: balance.billedCents - balance.paidCents,
            overdueCount: balance.overdueCount,
          })),
        recentNotifications,
        upcomingAssignments,
        upcomingEvents,
        unreadMessages,
        recentMessages,
      },
    };
  }

  private async getInstitutionContext() {
    const context = await this.dashboardsRepository.getInstitutionContext();

    if (!context) {
      throw new DashboardsServiceError('Institution not found', 404);
    }

    return context;
  }

  private toAcademicPeriod(period: ActivePeriodRow | null) {
    if (!period) {
      return null;
    }

    return {
      id: period.id,
      year: period.year,
      term: period.term,
      startDate: period.startDate,
      endDate: period.endDate,
      label: `${period.year} Term ${period.term}`,
    };
  }

  private toGradeSubmission(summary: {
    submitted: number;
    total: number;
  } | GradeSubmissionSummaryRow) {
    const submitted = Number(summary.submitted);
    const total = Number(summary.total);

    return {
      submitted,
      total,
      percent: total === 0 ? 0 : Math.round((submitted / total) * 100),
    };
  }

  private toModules(
    featureFlags: FeatureStatusRow[],
    extensions: { key: string; name: string | null; enabled: boolean }[]
  ) {
    return [
      ...featureFlags
        .filter((flag) => flag.key !== 'billing_module')
        .map((flag) => ({
        key: flag.key,
        name: this.toTitle(flag.key),
        enabled: flag.enabled,
        type: 'feature' as const,
        source: flag.source,
      })),
      ...extensions.map((extension) => ({
        key: extension.key,
        name: extension.name ?? this.toTitle(extension.key),
        enabled: extension.enabled,
        type: 'extension' as const,
        source: 'institution' as const,
      })),
    ];
  }

  private toRecentGrade(grade: RecentGradeRow) {
    return {
      ...grade,
      createdAt: grade.createdAt,
    };
  }

  private toStudentRisk(student: StudentRiskRow) {
    return {
      studentId: student.studentId,
      studentName: student.studentName,
      classroomName: student.classroomName,
      average:
        student.average === null || student.average === undefined
          ? null
          : Number(student.average),
      absences: Number(student.absences),
    };
  }

  private toTitle(value: string) {
    return value
      .split('_')
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
