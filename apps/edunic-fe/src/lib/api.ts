'use client';

import { clearSession, getSession } from './auth';
import { API_BASE_URL } from './config';

export type ApiListResponse<T> = {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
};

export type ApiSingleResponse<T> = {
  data: T;
};

export type Institution = {
  id: string;
  name: string;
  // PN-R1/SI-R2: the per-institution sender identity (design D4). Absent on
  // responses that do not select the columns, e.g. institution creation.
  senderName?: string | null;
  replyToEmail?: string | null;
  createdAt: string;
};

export type EmailDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'retried';

export type EmailDelivery = {
  id: string;
  eventId: string;
  eventName: string;
  recipientAddress: string;
  recipientSource: 'guardian' | 'user';
  studentId: string | null;
  status: EmailDeliveryStatus;
  attemptCount: number;
  providerMessageId: string | null;
  providerError: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type EmailDeliveryState = {
  emailNotificationsEnabled: boolean;
  senderIdentityConfigured: boolean;
};

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  createdAt: string | null;
};

export type AcademicPeriod = {
  id: string;
  year: number;
  term: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
};

export type Classroom = {
  id: string;
  gradeLevel: number;
  section: string | null;
  name: string;
};

export type Enrollment = {
  id: string;
  studentId: string;
  academicPeriodId: string;
  classroomId: string | null;
  status: 'active' | 'withdrawn' | 'completed';
  promotionStatus: string | null;
  createdAt: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
};

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type AttendanceRecord = {
  id: string;
  enrollmentId: string;
  date: string;
  status: AttendanceStatus;
  createdAt: string | null;
};

export type Subject = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
};

export type Grade = {
  id: string;
  enrollmentId: string;
  subjectId: string;
  topicId: string | null;
  subject: string;
  score: number;
  createdAt: string | null;
};

export type Extension = {
  key: string;
  name: string | null;
  enabled: boolean;
  // null = off for the school; an object (even {}) = on.
  config: Record<string, unknown> | null;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
};

export type AuditLog = {
  id: string;
  userId: string | null;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type DashboardAttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  marked: number;
};

export type DashboardNotification = {
  id: string;
  eventName: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string | null;
};

export type DashboardAssignment = {
  id: string;
  title: string;
  type: string;
  status: string;
  dueDate: string | null;
  classroomName: string | null;
};

export type DashboardEvent = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt: string | null;
  classroomName: string | null;
};

export type DashboardMessage = {
  id: string;
  subject: string;
  body: string;
  readAt: string | null;
  createdAt: string | null;
};

export type DashboardReportHistory = {
  id: string;
  studentId: string;
  studentName: string;
  year: number;
  reportType: string;
  createdAt: string | null;
};

export type WorkflowAssignment = DashboardAssignment & {
  classroomId: string | null;
  createdByUserId: string | null;
  createdAt: string | null;
};

export type WorkflowEvent = DashboardEvent & {
  classroomId: string | null;
  createdByUserId: string | null;
  createdAt: string | null;
};

export type WorkflowMessage = DashboardMessage & {
  threadId: string;
  senderUserId: string | null;
  recipientUserId: string | null;
};

export type DashboardModule = {
  key: string;
  name: string;
  enabled: boolean;
  type: 'feature' | 'extension';
  source: 'default' | 'institution';
};

export type AdminDashboard = {
  institution: {
    id: string;
    name: string;
  };
  activePeriod: {
    id: string;
    year: number;
    term: number;
    startDate: string | null;
    endDate: string | null;
    label: string;
  } | null;
  counts: {
    students: number;
    teachers: number;
    parents: number;
    guardians: number;
    activeEnrollments: number;
    classrooms: number;
  };
  attendanceToday: DashboardAttendanceSummary;
  gradeSubmission: {
    submitted: number;
    total: number;
    percent: number;
  };
  modules: DashboardModule[];
  recentNotifications: DashboardNotification[];
  recentAuditActivity: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string | null;
  }>;
  upcomingAssignments: DashboardAssignment[];
  upcomingEvents: DashboardEvent[];
  unreadMessages: number;
  recentMessages: DashboardMessage[];
  reportHistory: DashboardReportHistory[];
};

export type TeacherDashboard = {
  classrooms: Array<{
    id: string;
    name: string;
    gradeLevel: number;
    section: string | null;
    rosterCount: number;
    attendanceMarkedToday: number;
  }>;
  attendanceToday: DashboardAttendanceSummary;
  pendingAttendance: number;
  activeEnrollmentCount: number;
  recentGrades: DashboardGrade[];
  studentsAtRisk: Array<{
    studentId: string;
    studentName: string;
    classroomName: string | null;
    average: number | null;
    absences: number;
  }>;
  recentNotifications: DashboardNotification[];
  upcomingAssignments: DashboardAssignment[];
  upcomingEvents: DashboardEvent[];
  unreadMessages: number;
  recentMessages: DashboardMessage[];
};

export type DashboardGrade = {
  id: string;
  subject: string;
  score: number;
  createdAt: string | null;
  studentId: string;
  studentName: string;
};

export type DashboardPayment = {
  id: string;
  studentId: string;
  concept: string;
  amountCents: number;
  dueDate: string | null;
  status: string;
  method: string;
  receiptNumber: string;
};

export type DashboardPaymentBalance = {
  studentId: string;
  studentName: string;
  billedCents: number;
  paidCents: number;
  outstandingCents: number;
  overdueCount: number;
};

export type ParentDashboard = {
  students: Array<{
    studentId: string;
    fullName: string;
    dateOfBirth: string | null;
    guardianName: string;
    enrollmentId: string | null;
    classroomName: string | null;
    enrollmentStatus: string | null;
    academicYear: number | null;
    academicTerm: number | null;
    average: {
      average: number | null;
      gradeCount: number;
    };
    attendance: DashboardAttendanceSummary;
    recentGrades: DashboardGrade[];
    reportUrl: string;
  }>;
  payments: DashboardPayment[];
  balances: DashboardPaymentBalance[];
  recentNotifications: DashboardNotification[];
  upcomingAssignments: DashboardAssignment[];
  upcomingEvents: DashboardEvent[];
  unreadMessages: number;
  recentMessages: DashboardMessage[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      redirectToLogin();
    }

    throw new ApiError(getErrorMessage(payload), response.status, payload);
  }

  return payload as T;
}

async function readPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return 'The API request failed';
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const value = query.toString();
  return value ? `?${value}` : '';
}

export function toFeatureFlagMap(flags: FeatureFlag[]) {
  return flags.reduce<Record<string, boolean>>((result, flag) => {
    result[flag.key] = flag.enabled;
    return result;
  }, {});
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  const pathname = window.location.pathname;
  let loginPath = '/admin/login';

  if (pathname.startsWith('/teachers')) {
    loginPath = '/teachers/login';
  } else if (pathname.startsWith('/parents')) {
    loginPath = '/parents/login';
  }

  if (pathname !== loginPath) {
    window.location.replace(`${loginPath}?reason=session-expired`);
  }
}

export type StaffRole =
  | 'director'
  | 'vice_director'
  | 'subdirector'
  | 'teacher'
  | 'parent';

export type Teacher = {
  id: string;
  email: string;
  role: StaffRole;
  createdAt: string | null;
};

export type TeacherClassroom = {
  id: string;
  gradeLevel: number;
  section: string | null;
};

export function formatClassroom(classroom: { gradeLevel: number; section: string | null }) {
  return classroom.section
    ? `Grade ${classroom.gradeLevel} ${classroom.section}`
    : `Grade ${classroom.gradeLevel}`;
}
