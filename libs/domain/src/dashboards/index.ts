export { DashboardsService, DashboardsServiceError } from './application/dashboards.service.js';
export { DashboardsRepository } from './infrastructure/dashboards.repository.js';
export type {
  InstitutionContextRow,
  ActivePeriodRow,
  AttendanceSummaryRow,
  GradeSubmissionSummaryRow,
  FeatureStatusRow,
  ExtensionStatusRow,
  NotificationRow,
  AssignmentRow,
  SchoolEventRow,
  MessageRow,
  ReportHistoryRow,
  AuditActivityRow,
  ClassroomSnapshotRow,
  RecentGradeRow,
  StudentRiskRow,
  ParentStudentRow,
  StudentAverageRow,
} from './infrastructure/dashboards.repository.js';
export { institutionHeaderSchema } from './schemas/dashboard.schemas.js';
