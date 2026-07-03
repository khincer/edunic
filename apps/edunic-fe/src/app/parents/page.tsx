'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { FormField, TextAreaField } from '@/components/form-field';
import {
  apiRequest,
  type ApiSingleResponse,
  type ParentDashboard,
} from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { clearSession, getSession, type AdminSession } from '@/lib/auth';

export default function ParentsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [downloadId, setDownloadId] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [messageSubject, setMessageSubject] = useState('Family portal note');
  const [messageBody, setMessageBody] = useState('A quick note from the parent portal.');
  const [savingWorkflow, setSavingWorkflow] = useState('');

  useEffect(() => {
    const storedSession = getSession();
    setSession(storedSession);
    setReady(true);

    if (!storedSession) {
      router.replace('/parents/login');
      return;
    }

    if (storedSession.user.role === 'parent') {
      void loadDashboard(storedSession.user.institutionId);
    }
  }, [router]);

  async function loadDashboard(institutionId: string) {
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<ParentDashboard>>(
        '/dashboard/parent',
        { institutionId }
      );
      setDashboard(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load parent dashboard');
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

  function handleSignOut() {
    clearSession();
    setSession(null);
    router.replace('/parents/login');
  }

  async function downloadReport(studentId: string, reportUrl: string) {
    if (!session) {
      return;
    }

    setDownloadId(studentId);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}${reportUrl}`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
          'x-institution-id': session.user.institutionId,
        },
      });

      if (!response.ok) {
        throw new Error('Unable to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-report-${studentId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download report');
    } finally {
      setDownloadId('');
    }
  }

  if (!ready || !session) {
    return (
      <main className="portal-page">
        <nav className="portal-topnav" aria-label="Parent section navigation">
          <Link href="/">Edunic</Link>
          <div>
            <Link href="/admin/login">Admin</Link>
            <Link href="/teachers/login">Teachers</Link>
          </div>
        </nav>
        <section className="empty-state body-copy">Opening parent portal...</section>
      </main>
    );
  }

  const canUseParentPortal = session.user.role === 'parent';
  const students = dashboard?.students ?? [];
  const attendanceMarked = students.reduce(
    (total, student) => total + student.attendance.marked,
    0
  );
  const gradeCount = students.reduce(
    (total, student) => total + student.average.gradeCount,
    0
  );

  return (
    <main className="portal-page">
      <nav className="portal-topnav" aria-label="Parent section navigation">
        <Link href="/">Edunic</Link>
        <div>
          <Link href="/admin/login">Admin</Link>
          <Link href="/teachers/login">Teachers</Link>
          <button className="link-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </nav>

      <section className="portal-hero parent-hero">
        <p className="eyebrow">Parent portal</p>
        <h1 className="page-title">Family academic snapshot.</h1>
        <p className="body-copy">
          {session.user.email} is signed in for institution {session.user.institutionId}.
        </p>
      </section>

      {!canUseParentPortal ? (
        <div className="alert alert-error">
          This portal requires a parent role. Sign in with a parent or guardian account.
        </div>
      ) : null}

      {error ? <div className="alert alert-error portal-alert">{error}</div> : null}
      {notice ? <div className="alert alert-info portal-alert">{notice}</div> : null}

      {canUseParentPortal ? (
        <>
          <section className="portal-grid">
            <article className="card">
              <p className="eyebrow">Linked children</p>
              <p className="metric">{students.length}</p>
              <p className="body-copy">students connected through guardian records</p>
            </article>
            <article className="card">
              <p className="eyebrow">Grades</p>
              <p className="metric">{gradeCount}</p>
              <p className="body-copy">recent scores available for review</p>
            </article>
            <article className="card card-dark">
              <p className="eyebrow">Attendance</p>
              <p className="metric">{attendanceMarked}</p>
              <p className="body-copy muted-on-dark">attendance marks recorded in the portal</p>
            </article>
            <article className="card">
              <p className="eyebrow">Messages</p>
              <p className="metric">{dashboard?.unreadMessages ?? 0}</p>
              <p className="body-copy">unread family messages</p>
            </article>
          </section>

          <section className="parent-student-list">
            {students.map((student) => (
              <article className="card parent-student-card" key={student.studentId}>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">{student.guardianName}</p>
                    <h2 className="section-title">{student.fullName}</h2>
                    <p className="body-copy">
                      {student.classroomName ?? 'No classroom'} -{' '}
                      {student.enrollmentStatus ?? 'not enrolled'} - Term{' '}
                      {student.academicTerm ?? 'n/a'}
                    </p>
                  </div>
                  <Button
                    disabled={downloadId === student.studentId}
                    onClick={() => void downloadReport(student.studentId, student.reportUrl)}
                    variant="secondary"
                  >
                    {downloadId === student.studentId ? 'Preparing...' : 'Report PDF'}
                  </Button>
                </div>

                <div className="student-snapshot-grid">
                  <div>
                    <span>Average</span>
                    <strong>{student.average.average ?? 'n/a'}</strong>
                  </div>
                  <div>
                    <span>Present</span>
                    <strong>{student.attendance.present}</strong>
                  </div>
                  <div>
                    <span>Late</span>
                    <strong>{student.attendance.late}</strong>
                  </div>
                  <div>
                    <span>Absent</span>
                    <strong>{student.attendance.absent}</strong>
                  </div>
                </div>

                <div className="grade-chip-list" aria-label={`${student.fullName} recent grades`}>
                  {student.recentGrades.map((grade) => (
                    <span className="grade-chip" key={grade.id}>
                      <strong>{grade.score}</strong>
                      {grade.subject}
                    </span>
                  ))}
                </div>
              </article>
            ))}
            {students.length === 0 ? (
              <div className="empty-state body-copy">
                No linked students were found for this institution.
              </div>
            ) : null}
          </section>

          <section className="portal-band">
            <article className="card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Upcoming work</p>
                  <h2 className="section-title">Homework and exams</h2>
                </div>
              </div>
              <div className="activity-list">
                {(dashboard?.upcomingAssignments ?? []).map((assignment) => (
                  <article className="activity-row" key={assignment.id}>
                    <span className="activity-mark">{assignment.type.slice(0, 1)}</span>
                    <span>
                      <strong>{assignment.title}</strong>
                      <p className="field-help">
                        {assignment.classroomName ?? 'Classroom'} -{' '}
                        {assignment.dueDate ? assignment.dueDate.slice(0, 10) : 'No due date'}
                      </p>
                    </span>
                  </article>
                ))}
              </div>
            </article>

            <article className="card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Calendar and inbox</p>
                  <h2 className="section-title">What is next</h2>
                </div>
              </div>
              <div className="activity-list">
                {(dashboard?.upcomingEvents ?? []).map((event) => (
                  <article className="activity-row" key={event.id}>
                    <span className="activity-mark">E</span>
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
                    <span className="activity-mark">M</span>
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
              </div>
            </article>
          </section>

          <section className="card section-stack">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Message</p>
                <h2 className="section-title">Send a family note</h2>
              </div>
            </div>
            <div className="workflow-inline-form">
              <FormField label="Recipient user ID" name="parentRecipientUserId" onChange={(event) => setRecipientUserId(event.target.value)} value={recipientUserId} />
              <FormField label="Subject" name="parentMessageSubject" onChange={(event) => setMessageSubject(event.target.value)} value={messageSubject} />
              <TextAreaField label="Message" name="parentMessageBody" onChange={(event) => setMessageBody(event.target.value)} rows={3} value={messageBody} />
              <Button disabled={savingWorkflow === 'message' || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()} onClick={() => void sendMessage()}>
                {savingWorkflow === 'message' ? 'Sending...' : 'Send message'}
              </Button>
            </div>
          </section>

          <section className="card card-soft portal-band">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2 className="section-title">School updates</h2>
            </div>
            <div className="activity-list">
              {(dashboard?.recentNotifications ?? []).map((notification) => (
                <article className="activity-row activity-row-action" data-unread={!notification.readAt} key={notification.id}>
                  <span className="activity-mark">N</span>
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
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
