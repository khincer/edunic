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
  constructor(private readonly dashboardsRepository: DashboardsRepository) {}

  async getAdminDashboard(institutionId: string, userId: string) {
    const context = await this.getInstitutionContext(institutionId);
    const activePeriod =
      await this.dashboardsRepository.getActiveAcademicPeriod(institutionId);

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
      this.dashboardsRepository.countStudents(institutionId),
      this.dashboardsRepository.countUsersByRole(institutionId, 'teacher'),
      this.dashboardsRepository.countUsersByRole(institutionId, 'parent'),
      this.dashboardsRepository.countGuardians(institutionId),
      this.dashboardsRepository.countActiveEnrollments(institutionId),
      this.dashboardsRepository.countClassrooms(institutionId),
      this.dashboardsRepository.getTodayAttendanceSummary(institutionId),
      this.dashboardsRepository.getGradeSubmissionSummary(
        institutionId,
        activePeriod?.id ?? null
      ),
      this.dashboardsRepository.listFeatureStatuses(institutionId),
      this.dashboardsRepository.listExtensionStatuses(institutionId),
      this.dashboardsRepository.listRecentNotifications({
        institutionId,
        role: 'admin',
        userId,
      }),
      this.dashboardsRepository.listRecentAuditActivity(institutionId),
      this.dashboardsRepository.listUpcomingAssignments({
        institutionId,
        role: 'admin',
      }),
      this.dashboardsRepository.listUpcomingEvents({
        institutionId,
        role: 'admin',
      }),
      this.dashboardsRepository.countUnreadMessages(institutionId, userId),
      this.dashboardsRepository.listRecentMessages(institutionId, userId),
      this.dashboardsRepository.listReportHistory(institutionId),
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

  async getTeacherDashboard(input: {
    institutionId: string;
    userId: string;
    role: string;
  }) {
    const { institutionId, userId, role } = input;
    await this.getInstitutionContext(institutionId);
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
      this.dashboardsRepository.listClassroomSnapshots(institutionId, teacherUserId),
      this.dashboardsRepository.getTodayAttendanceSummary(institutionId, teacherUserId),
      this.dashboardsRepository.countActiveEnrollments(institutionId, teacherUserId),
      this.dashboardsRepository.listRecentGrades(institutionId, 5, teacherUserId),
      this.dashboardsRepository.listStudentsAtRisk(institutionId, 5, teacherUserId),
      this.dashboardsRepository.listRecentNotifications({
        institutionId,
        role,
        userId,
      }),
      this.dashboardsRepository.listUpcomingAssignments({
        institutionId,
        role,
        userId,
      }),
      this.dashboardsRepository.listUpcomingEvents({
        institutionId,
        role,
        userId,
      }),
      this.dashboardsRepository.countUnreadMessages(institutionId, userId),
      this.dashboardsRepository.listRecentMessages(institutionId, userId),
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

  async getParentDashboard(institutionId: string, userId: string) {
    await this.getInstitutionContext(institutionId);

    const currentYear = new Date().getFullYear();
    const [
      students,
      recentNotifications,
      upcomingAssignments,
      upcomingEvents,
      unreadMessages,
      recentMessages,
    ] = await Promise.all([
      this.dashboardsRepository.listParentStudents(institutionId, userId),
      this.dashboardsRepository.listRecentNotifications({
        institutionId,
        role: 'parent',
        userId,
      }),
      this.dashboardsRepository.listUpcomingAssignments({
        institutionId,
        role: 'parent',
        userId,
      }),
      this.dashboardsRepository.listUpcomingEvents({
        institutionId,
        role: 'parent',
        userId,
      }),
      this.dashboardsRepository.countUnreadMessages(institutionId, userId),
      this.dashboardsRepository.listRecentMessages(institutionId, userId),
    ]);

    const studentSummaries = await Promise.all(
      students.map(async (student) => {
        const [average, attendance, recentGrades] = await Promise.all([
          this.dashboardsRepository.getStudentAverage(
            institutionId,
            student.studentId,
            student.academicYear ?? currentYear
          ),
          this.dashboardsRepository.getStudentAttendanceSummary(
            institutionId,
            student.studentId
          ),
          this.dashboardsRepository.listStudentRecentGrades(
            institutionId,
            student.studentId
          ),
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

    return {
      data: {
        students: studentSummaries,
        recentNotifications,
        upcomingAssignments,
        upcomingEvents,
        unreadMessages,
        recentMessages,
      },
    };
  }

  private async getInstitutionContext(institutionId: string) {
    const context =
      await this.dashboardsRepository.getInstitutionContext(institutionId);

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
