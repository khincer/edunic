import {
  createEventEnvelope,
  type EventEnvelope,
} from './events.js';

export type EnrollmentCreatedPayload = {
  enrollmentId: string;
  studentId: string;
  academicPeriodId: string;
  classroomId: string | null;
};

export type GradeSubmittedPayload = {
  gradeId: string;
  enrollmentId: string;
  subject: string;
  score: number;
};

export type AttendanceMarkedPayload = {
  attendanceId: string;
  enrollmentId: string;
  date: string | Date;
  status: string;
};

export type EnrollmentCreatedEvent = EventEnvelope<
  'enrollment.created',
  EnrollmentCreatedPayload
>;

export type GradeSubmittedEvent = EventEnvelope<
  'grade.submitted',
  GradeSubmittedPayload
>;

export type AttendanceMarkedEvent = EventEnvelope<
  'attendance.marked',
  AttendanceMarkedPayload
>;

export type AcademicDomainEvent =
  | EnrollmentCreatedEvent
  | GradeSubmittedEvent
  | AttendanceMarkedEvent;

export function createEnrollmentCreatedEvent(input: {
  institutionId: string;
  payload: EnrollmentCreatedPayload;
}) {
  return createEventEnvelope({
    name: 'enrollment.created',
    institutionId: input.institutionId,
    payload: input.payload,
  });
}

export function createGradeSubmittedEvent(input: {
  institutionId: string;
  payload: GradeSubmittedPayload;
}) {
  return createEventEnvelope({
    name: 'grade.submitted',
    institutionId: input.institutionId,
    payload: input.payload,
  });
}

export function createAttendanceMarkedEvent(input: {
  institutionId: string;
  payload: AttendanceMarkedPayload;
}) {
  return createEventEnvelope({
    name: 'attendance.marked',
    institutionId: input.institutionId,
    payload: input.payload,
  });
}
