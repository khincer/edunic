'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ActivityMark, getAssignmentActivityKind } from '@/components/activity-mark';
import { Button } from '@/components/button';
import { FormField, TextAreaField } from '@/components/form-field';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  buildQuery,
  type ApiListResponse,
  type ApiSingleResponse,
  type AttendanceRecord,
  type AttendanceStatus,
  type Classroom,
  type Enrollment,
  type Grade,
  type TeacherDashboard,
} from '@/lib/api';
import { clearSession, getSession, type AdminSession } from '@/lib/auth';

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLocalDateTime(offsetDays = 1) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  value.setHours(9, 0, 0, 0);
  return value.toISOString().slice(0, 16);
}

export default function TeachersPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [gradeSubject, setGradeSubject] = useState('Mathematics');
  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [notice, setNotice] = useState('');
  const [workflowTitle, setWorkflowTitle] = useState('Classroom practice set');
  const [workflowType, setWorkflowType] = useState<'homework' | 'exam' | 'assignment'>('homework');
  const [workflowDueDate, setWorkflowDueDate] = useState(getLocalDateTime(2));
  const [eventTitle, setEventTitle] = useState('Classroom review session');
  const [eventStartsAt, setEventStartsAt] = useState(getLocalDateTime(3));
  const [recipientUserId, setRecipientUserId] = useState('');
  const [messageSubject, setMessageSubject] = useState('Classroom update');
  const [messageBody, setMessageBody] = useState('A quick note from the teacher workspace.');
  const [savingWorkflow, setSavingWorkflow] = useState('');

  const canUseTeacherTools = session?.user.role === 'teacher' || session?.user.role === 'admin';
  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === selectedClassroomId),
    [classrooms, selectedClassroomId]
  );
  const attendanceSummary = useMemo(() => {
    return enrollments.reduce(
      (summary, enrollment) => {
        const status = attendanceStatus[enrollment.id] ?? 'present';
        summary[status] += 1;
        return summary;
      },
      { present: 0, absent: 0, late: 0 } satisfies Record<AttendanceStatus, number>
    );
  }, [attendanceStatus, enrollments]);

  useEffect(() => {
    const storedSession = getSession();
    setSession(storedSession);
    setReady(true);

    if (!storedSession) {
      router.replace('/teachers/login');
    }
  }, [router]);

  useEffect(() => {
    if (!session || !canUseTeacherTools) {
      return;
    }

    void loadClassrooms(session.user.institutionId);
    void loadDashboard(session.user.institutionId);
  }, [canUseTeacherTools, session]);

  useEffect(() => {
    if (!session || !selectedClassroomId) {
      setEnrollments([]);
      return;
    }

    void loadRoster(session.user.institutionId, selectedClassroomId);
  }, [selectedClassroomId, session]);

  useEffect(() => {
    if (!session || enrollments.length === 0) {
      setAttendanceStatus({});
      setAttendanceRecords({});
      return;
    }

    void loadAttendanceForDate(session.user.institutionId, enrollments, attendanceDate);
  }, [attendanceDate, enrollments, session]);

  function handleSignOut() {
    clearSession();
    setSession(null);
    setClassrooms([]);
    setDashboard(null);
    setSelectedClassroomId('');
    setEnrollments([]);
    setNotice('');
    router.replace('/teachers/login');
  }

  async function loadClassrooms(nextInstitutionId: string) {
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiListResponse<Classroom>>(
        '/classrooms?limit=100&sortBy=gradeLevel&sortOrder=asc',
        { institutionId: nextInstitutionId }
      );
      setClassrooms(result.data);
      setSelectedClassroomId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load classrooms');
    } finally {
      setLoading(false);
    }
  }

  async function loadRoster(nextInstitutionId: string, classroomId: string) {
    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        classroomId,
        status: 'active',
        sortBy: 'studentName',
        sortOrder: 'asc',
        limit: 100,
      });
      const result = await apiRequest<ApiListResponse<Enrollment>>(
        `/enrollments${query}`,
        { institutionId: nextInstitutionId }
      );
      setEnrollments(result.data);
      setGradeScores({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load roster');
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceForDate(
    nextInstitutionId: string,
    roster: Enrollment[],
    date: string
  ) {
    setError('');

    try {
      const pairs = await Promise.all(
        roster.map(async (enrollment) => {
          const query = buildQuery({
            enrollmentId: enrollment.id,
            date,
            limit: 1,
          });
          const result = await apiRequest<ApiListResponse<AttendanceRecord>>(
            `/attendance${query}`,
            { institutionId: nextInstitutionId }
          );
          return [enrollment.id, result.data[0] ?? null] as const;
        })
      );
      const nextRecords: Record<string, AttendanceRecord> = {};
      const nextStatuses: Record<string, AttendanceStatus> = {};

      for (const [enrollmentId, record] of pairs) {
        if (record) {
          nextRecords[enrollmentId] = record;
          nextStatuses[enrollmentId] = record.status;
        } else {
          nextStatuses[enrollmentId] = 'present';
        }
      }

      setAttendanceRecords(nextRecords);
      setAttendanceStatus(nextStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance');
    }
  }

  async function saveAttendance() {
    if (!session) {
      return;
    }

    setSavingAttendance(true);
    setError('');
    setNotice('');

    try {
      await Promise.all(
        enrollments.map((enrollment) => {
          const existingRecord = attendanceRecords[enrollment.id];
          const status = attendanceStatus[enrollment.id] ?? 'present';

          if (existingRecord) {
            return apiRequest<ApiSingleResponse<AttendanceRecord>>(
              `/attendance/${existingRecord.id}`,
              {
                method: 'PATCH',
                institutionId: session.user.institutionId,
                body: { status },
              }
            );
          }

          return apiRequest<ApiSingleResponse<AttendanceRecord>>('/attendance', {
            method: 'POST',
            institutionId: session.user.institutionId,
            body: {
              enrollmentId: enrollment.id,
              date: attendanceDate,
              status,
            },
          });
        })
      );
      await loadAttendanceForDate(session.user.institutionId, enrollments, attendanceDate);
      setNotice('Attendance saved for the selected date.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  }

  async function submitGrades() {
    if (!session) {
      return;
    }

    const scores = enrollments
      .map((enrollment) => ({
        enrollment,
        score: gradeScores[enrollment.id]?.trim(),
      }))
      .filter((item) => item.score !== undefined && item.score !== '');

    if (scores.length === 0) {
      setError('Enter at least one score before submitting grades.');
      return;
    }

    setSavingGrades(true);
    setError('');
    setNotice('');

    try {
      await Promise.all(
        scores.map(({ enrollment, score }) =>
          apiRequest<ApiSingleResponse<Grade>>('/grades', {
            method: 'POST',
            institutionId: session.user.institutionId,
            body: {
              enrollmentId: enrollment.id,
              subject: gradeSubject,
              score: Number(score),
            },
          })
        )
      );
      setGradeScores({});
      setNotice(`Submitted ${scores.length} grade${scores.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit grades');
    } finally {
      setSavingGrades(false);
    }
  }

  if (!ready || !session) {
    return (
      <main className="portal-page">
        <nav className="portal-topnav" aria-label="Teacher section navigation">
          <Link href="/">Edunic</Link>
          <div>
            <Link href="/admin">Admin</Link>
            <Link href="/students">Students</Link>
          </div>
        </nav>

        <section className="empty-state body-copy">Opening teacher workspace...</section>
      </main>
    );
  }

  async function createAssignment() {
    if (!session || !selectedClassroomId || !workflowTitle.trim()) {
      return;
    }

    setSavingWorkflow('assignment');
    setError('');
    setNotice('');

    try {
      await apiRequest('/assignments', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          classroomId: selectedClassroomId,
          title: workflowTitle,
          type: workflowType,
          status: 'published',
          dueDate: workflowDueDate ? new Date(workflowDueDate).toISOString() : undefined,
        },
      });
      setNotice('Classroom work published.');
      await loadDashboard(session.user.institutionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish classroom work');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function createClassroomEvent() {
    if (!session || !selectedClassroomId || !eventTitle.trim() || !eventStartsAt) {
      return;
    }

    setSavingWorkflow('event');
    setError('');
    setNotice('');

    try {
      await apiRequest('/school-events', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          classroomId: selectedClassroomId,
          title: eventTitle,
          eventType: 'classroom',
          startsAt: new Date(eventStartsAt).toISOString(),
        },
      });
      setNotice('Classroom event scheduled.');
      await loadDashboard(session.user.institutionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule event');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function sendMessage() {
    if (!session || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()) {
      return;
    }

    setSavingWorkflow('message');
    setError('');
    setNotice('');

    try {
      await apiRequest('/messages', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          recipientUserId,
          subject: messageSubject,
          body: messageBody,
        },
      });
      setMessageBody('');
      setNotice('Message sent.');
      await loadDashboard(session.user.institutionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!session) {
      return;
    }

    setSavingWorkflow(notificationId);
    setError('');

    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
        institutionId: session.user.institutionId,
      });
      await loadDashboard(session.user.institutionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark notification read');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function markMessageRead(messageId: string) {
    if (!session) {
      return;
    }

    setSavingWorkflow(messageId);
    setError('');

    try {
      await apiRequest(`/messages/${messageId}/read`, {
        method: 'PATCH',
        institutionId: session.user.institutionId,
      });
      await loadDashboard(session.user.institutionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark message read');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function loadDashboard(nextInstitutionId: string) {
    setDashboardError('');
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<TeacherDashboard>>(
        '/dashboard/teacher',
        { institutionId: nextInstitutionId }
      );
      setDashboard(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load teacher dashboard';
      setDashboard(null);
      setDashboardError(message);
      setError(message);
    }
  }

  return (
    <main className="portal-page">
      <nav className="portal-topnav" aria-label="Teacher section navigation">
        <Link href="/">Edunic</Link>
        <div>
          <Link href="/admin">Admin</Link>
          <Link href="/students">Students</Link>
          <button className="link-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </nav>

      <section className="teacher-header">
        <div>
          <p className="eyebrow">Teacher workspace</p>
          <h1 className="page-title">Attendance and grade submission.</h1>
          <p className="body-copy">
            {session.user.email} is working inside institution {session.user.institutionId}.
          </p>
        </div>
        <div className="teacher-summary">
          <div>
            <span>Present</span>
            <strong>{dashboard?.attendanceToday.present ?? attendanceSummary.present}</strong>
          </div>
          <div>
            <span>Late</span>
            <strong>{dashboard?.attendanceToday.late ?? attendanceSummary.late}</strong>
          </div>
          <div>
            <span>Absent</span>
            <strong>{dashboard?.attendanceToday.absent ?? attendanceSummary.absent}</strong>
          </div>
        </div>
      </section>

      {!canUseTeacherTools ? (
        <div className="alert alert-error">
          This account cannot use teacher tools. Sign in as a teacher or admin.
        </div>
      ) : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-info">{notice}</div> : null}

      {canUseTeacherTools ? (
        <>
        <section className="teacher-home-grid">
          <article className="card teacher-home-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Today</p>
                <h2 className="section-title">Classroom readiness</h2>
              </div>
              <span className="badge badge-blue">
                {dashboard?.pendingAttendance ?? 0} pending
              </span>
            </div>
            <div className="classroom-snapshot-list">
              {(dashboard?.classrooms ?? []).map((classroom) => (
                <div className="classroom-snapshot-row" key={classroom.id}>
                  <span>
                    <strong>{classroom.name}</strong>
                    <p className="field-help">{classroom.rosterCount} active students</p>
                  </span>
                  <span className="badge">
                    {classroom.attendanceMarkedToday}/{classroom.rosterCount} marked
                  </span>
                </div>
              ))}
              {dashboard ? null : (
                <PanelState
                  message={dashboardError ? 'Dashboard data could not load.' : 'Loading classroom readiness...'}
                  tone={dashboardError ? 'error' : 'loading'}
                />
              )}
              {dashboard && dashboard.classrooms.length === 0 ? (
                <PanelState message="No assigned classrooms are ready yet." />
              ) : null}
            </div>
          </article>

          <article className="card teacher-home-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Academic risk</p>
                <h2 className="section-title">Needs attention</h2>
              </div>
            </div>
            <div className="activity-list">
              {(dashboard?.studentsAtRisk ?? []).map((student) => (
                <article className="activity-row" key={student.studentId}>
                  <ActivityMark kind="risk" tone="danger" />
                  <span>
                    <strong>{student.studentName}</strong>
                    <p className="field-help">
                      {student.classroomName ?? 'No classroom'} - avg{' '}
                      {student.average ?? 'n/a'} - {student.absences} absences
                    </p>
                  </span>
                </article>
              ))}
              {dashboard ? null : (
                <PanelState
                  message={dashboardError ? 'Academic risk data could not load.' : 'Loading risk signals...'}
                  tone={dashboardError ? 'error' : 'loading'}
                />
              )}
              {dashboard && dashboard.studentsAtRisk.length === 0 ? (
                <PanelState message="No risk alerts for the current roster." />
              ) : null}
            </div>
          </article>
        </section>

        <section className="teacher-home-grid">
          <article className="card teacher-home-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recent grades</p>
                <h2 className="section-title">Latest submissions</h2>
              </div>
            </div>
            <div className="activity-list">
              {(dashboard?.recentGrades ?? []).map((grade) => (
                <article className="activity-row" key={grade.id}>
                  <span className="activity-mark activity-mark-value">{grade.score}</span>
                  <span>
                    <strong>{grade.studentName}</strong>
                    <p className="field-help">{grade.subject}</p>
                  </span>
                </article>
              ))}
              {dashboard ? null : (
                <PanelState
                  message={dashboardError ? 'Recent grades could not load.' : 'Loading recent grades...'}
                  tone={dashboardError ? 'error' : 'loading'}
                />
              )}
              {dashboard && dashboard.recentGrades.length === 0 ? (
                <PanelState message="No recent grade submissions yet." />
              ) : null}
            </div>
          </article>

          <article className="card teacher-home-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Notifications</p>
                <h2 className="section-title">School signals</h2>
              </div>
            </div>
            <div className="activity-list">
              {(dashboard?.recentNotifications ?? []).map((notification) => (
                <article className="activity-row activity-row-action" data-unread={!notification.readAt} key={notification.id}>
                  <ActivityMark kind="notification" />
                  <span>
                    <strong>{notification.title}</strong>
                    <p className="field-help">
                      {notification.message} - {notification.readAt ? 'read' : 'unread'}
                    </p>
                  </span>
                  <Button
                    disabled={Boolean(notification.readAt) || savingWorkflow === notification.id}
                    onClick={() => void markNotificationRead(notification.id)}
                    variant="secondary"
                  >
                    {notification.readAt ? 'Read' : 'Mark read'}
                  </Button>
                </article>
              ))}
              {dashboard ? null : (
                <PanelState
                  message={dashboardError ? 'Notifications could not load.' : 'Loading notifications...'}
                  tone={dashboardError ? 'error' : 'loading'}
                />
              )}
              {dashboard && dashboard.recentNotifications.length === 0 ? (
                <PanelState message="No school signals yet." />
              ) : null}
            </div>
          </article>
        </section>

        <section className="teacher-home-grid">
          <article className="card teacher-home-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Upcoming work</p>
                <h2 className="section-title">Assignments and exams</h2>
              </div>
            </div>
            <div className="activity-list">
              {(dashboard?.upcomingAssignments ?? []).map((assignment) => (
                <article className="activity-row" key={assignment.id}>
                  <ActivityMark kind={getAssignmentActivityKind(assignment.type)} />
                  <span>
                    <strong>{assignment.title}</strong>
                    <p className="field-help">
                      {assignment.classroomName ?? 'Classroom'} -{' '}
                      {assignment.dueDate ? assignment.dueDate.slice(0, 10) : 'No due date'}
                    </p>
                  </span>
                </article>
              ))}
              {dashboard ? null : (
                <PanelState
                  message={dashboardError ? 'Assignments could not load.' : 'Loading assignments...'}
                  tone={dashboardError ? 'error' : 'loading'}
                />
              )}
              {dashboard && dashboard.upcomingAssignments.length === 0 ? (
                <PanelState message="No upcoming assignments or exams." />
              ) : null}
            </div>
          </article>

          <article className="card teacher-home-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Inbox and calendar</p>
                <h2 className="section-title">{dashboard?.unreadMessages ?? 0} unread messages</h2>
              </div>
            </div>
            <div className="activity-list">
              {(dashboard?.upcomingEvents ?? []).map((event) => (
                <article className="activity-row" key={event.id}>
                  <ActivityMark kind="calendar" />
                  <span>
                    <strong>{event.title}</strong>
                    <p className="field-help">
                      {event.classroomName ?? 'School-wide'} - {event.startsAt.slice(0, 10)}
                    </p>
                  </span>
                </article>
              ))}
              {(dashboard?.recentMessages ?? []).map((message) => (
                <article className="activity-row activity-row-action" data-unread={!message.readAt} key={message.id}>
                  <ActivityMark kind="message" />
                  <span>
                    <strong>{message.subject}</strong>
                    <p className="field-help">{message.body}</p>
                  </span>
                  <Button
                    disabled={Boolean(message.readAt) || savingWorkflow === message.id}
                    onClick={() => void markMessageRead(message.id)}
                    variant="secondary"
                  >
                    {message.readAt ? 'Read' : 'Mark read'}
                  </Button>
                </article>
              ))}
              {dashboard ? null : (
                <PanelState
                  message={dashboardError ? 'Inbox and calendar could not load.' : 'Loading inbox and calendar...'}
                  tone={dashboardError ? 'error' : 'loading'}
                />
              )}
              {dashboard &&
              dashboard.upcomingEvents.length === 0 &&
              dashboard.recentMessages.length === 0 ? (
                <PanelState message="No calendar items or messages yet." />
              ) : null}
            </div>
          </article>
        </section>

        <section className="workflow-console-grid">
          <article className="card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Publish</p>
                <h2 className="section-title">Classroom work</h2>
              </div>
            </div>
            <div className="form">
              <FormField label="Title" name="workflowTitle" onChange={(event) => setWorkflowTitle(event.target.value)} value={workflowTitle} />
              <label className="form-field" htmlFor="workflowType">
                <span>Type</span>
                <select id="workflowType" onChange={(event) => setWorkflowType(event.target.value as 'homework' | 'exam' | 'assignment')} value={workflowType}>
                  <option value="homework">homework</option>
                  <option value="exam">exam</option>
                  <option value="assignment">assignment</option>
                </select>
              </label>
              <FormField label="Due date" name="workflowDueDate" onChange={(event) => setWorkflowDueDate(event.target.value)} type="datetime-local" value={workflowDueDate} />
              <Button disabled={savingWorkflow === 'assignment' || !selectedClassroomId || !workflowTitle.trim()} onClick={() => void createAssignment()}>
                {savingWorkflow === 'assignment' ? 'Publishing...' : 'Publish work'}
              </Button>
            </div>
          </article>

          <article className="card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Calendar</p>
                <h2 className="section-title">Classroom event</h2>
              </div>
            </div>
            <div className="form">
              <FormField label="Title" name="teacherEventTitle" onChange={(event) => setEventTitle(event.target.value)} value={eventTitle} />
              <FormField label="Starts at" name="teacherEventStartsAt" onChange={(event) => setEventStartsAt(event.target.value)} type="datetime-local" value={eventStartsAt} />
              <Button disabled={savingWorkflow === 'event' || !selectedClassroomId || !eventTitle.trim()} onClick={() => void createClassroomEvent()}>
                {savingWorkflow === 'event' ? 'Scheduling...' : 'Schedule event'}
              </Button>
            </div>
          </article>

          <article className="card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Message</p>
                <h2 className="section-title">Family/admin thread</h2>
              </div>
            </div>
            <div className="form">
              <FormField label="Recipient user ID" name="teacherRecipientUserId" onChange={(event) => setRecipientUserId(event.target.value)} value={recipientUserId} />
              <FormField label="Subject" name="teacherMessageSubject" onChange={(event) => setMessageSubject(event.target.value)} value={messageSubject} />
              <TextAreaField label="Message" name="teacherMessageBody" onChange={(event) => setMessageBody(event.target.value)} rows={4} value={messageBody} />
              <Button disabled={savingWorkflow === 'message' || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()} onClick={() => void sendMessage()}>
                {savingWorkflow === 'message' ? 'Sending...' : 'Send message'}
              </Button>
            </div>
          </article>
        </section>

        <section className="teacher-layout">
          <aside className="card teacher-controls">
            <div className="form-field">
              <label htmlFor="classroom">Classroom</label>
              <select
                disabled={loading || classrooms.length === 0}
                id="classroom"
                onChange={(event) => setSelectedClassroomId(event.target.value)}
                value={selectedClassroomId}
              >
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="Attendance date"
              name="attendanceDate"
              onChange={(event) => setAttendanceDate(event.target.value)}
              type="date"
              value={attendanceDate}
            />
            <FormField
              label="Grade subject"
              name="gradeSubject"
              onChange={(event) => setGradeSubject(event.target.value)}
              required
              type="text"
              value={gradeSubject}
            />
            <div className="classroom-context">
              <span className="badge badge-blue">{selectedClassroom?.name ?? 'No classroom'}</span>
              <p className="body-copy">
                {loading
                  ? 'Loading classroom data...'
                  : `${enrollments.length} active enrollment${enrollments.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </aside>

          <section className="card teacher-roster">
            <div className="page-header">
              <div>
                <p className="eyebrow">Daily roster</p>
                <h2 className="section-title">Mark attendance and enter scores</h2>
              </div>
              <div className="button-row">
                <Button
                  disabled={savingAttendance || enrollments.length === 0}
                  onClick={saveAttendance}
                >
                  {savingAttendance ? 'Saving...' : 'Save attendance'}
                </Button>
                <Button
                  disabled={savingGrades || enrollments.length === 0 || !gradeSubject.trim()}
                  onClick={submitGrades}
                  variant="secondary"
                >
                  {savingGrades ? 'Submitting...' : 'Submit grades'}
                </Button>
              </div>
            </div>

            {enrollments.length === 0 && !loading ? (
              <PanelState message="No active enrollments were found for this classroom." />
            ) : null}

            <div className="teacher-student-list">
              {enrollments.map((enrollment) => (
                <article className="teacher-student-row" key={enrollment.id}>
                  <div>
                    <strong>{enrollment.student.fullName}</strong>
                    <p className="field-help">Enrollment {enrollment.id}</p>
                  </div>
                  <div className="attendance-toggle" aria-label={`${enrollment.student.fullName} attendance`}>
                    {(['present', 'late', 'absent'] as AttendanceStatus[]).map((status) => (
                      <button
                        data-active={(attendanceStatus[enrollment.id] ?? 'present') === status}
                        key={status}
                        onClick={() =>
                          setAttendanceStatus((current) => ({
                            ...current,
                            [enrollment.id]: status,
                          }))
                        }
                        type="button"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <label className="score-cell">
                    <span>Score</span>
                    <input
                      max={100}
                      min={0}
                      onChange={(event) =>
                        setGradeScores((current) => ({
                          ...current,
                          [enrollment.id]: event.target.value,
                        }))
                      }
                      placeholder="0-100"
                      type="number"
                      value={gradeScores[enrollment.id] ?? ''}
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>
        </section>
        </>
      ) : null}
    </main>
  );
}
