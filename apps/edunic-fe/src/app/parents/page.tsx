'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ActivityMark, getAssignmentActivityKind } from '@/components/activity-mark';
import { Button } from '@/components/button';
import { FormField, TextAreaField } from '@/components/form-field';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  formatCents,
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
  const [messageSubject, setMessageSubject] = useState('Nota del portal de familias');
  const [messageBody, setMessageBody] = useState('Una nota breve del portal de familias.');
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
      void loadDashboard();
    }
  }, [router]);

  async function loadDashboard() {
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<ParentDashboard>>(
        '/dashboard/parent',
        {}
      );
      setDashboard(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel de familias');
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
        body: {
          recipientUserId,
          subject: messageSubject,
          body: messageBody,
        },
      });
      setMessageBody('');
      setNotice('Mensaje enviado.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
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
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar el mensaje como leído');
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
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar la notificación como leída');
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
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo descargar el informe');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-report-${studentId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el informe');
    } finally {
      setDownloadId('');
    }
  }

  if (!ready || !session) {
    return (
      <main className="portal-page">
        <section className="empty-state body-copy">Abriendo el portal de familias…</section>
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
      <nav className="portal-topnav" aria-label="Navegación de la sección de familias">
        <Link href="/">Edunic</Link>
        <div>
          <button className="link-button" onClick={handleSignOut} type="button">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <section className="portal-hero">
        <h1 className="page-title">Sus hijos</h1>
        <p className="body-copy">Sesión iniciada como {session.user.email}</p>
      </section>

      {!canUseParentPortal ? (
        <div className="alert alert-error">
          Este portal requiere el rol de familia. Inicie sesión con una cuenta de familia o tutor.
        </div>
      ) : null}

      {error ? <div className="alert alert-error portal-alert">{error}</div> : null}
      {notice ? <div className="alert alert-info portal-alert">{notice}</div> : null}

      {canUseParentPortal ? (
        <>
          <section className="portal-grid">
            <article className="card metric-card">
              <p className="eyebrow">Hijos vinculados</p>
              <p className="metric">{students.length}</p>
              <p className="body-copy">vinculados a su cuenta</p>
            </article>
            <article className="card metric-card">
              <p className="eyebrow">Calificaciones</p>
              <p className="metric">{gradeCount}</p>
              <p className="body-copy">calificaciones recientes</p>
            </article>
            <article className="card metric-card">
              <p className="eyebrow">Asistencia</p>
              <p className="metric">{attendanceMarked}</p>
              <p className="body-copy">registros de asistencia</p>
            </article>
            <article className="card metric-card">
              <p className="eyebrow">Mensajes</p>
              <p className="metric">{dashboard?.unreadMessages ?? 0}</p>
              <p className="body-copy">sin leer</p>
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
                      {student.classroomName ?? 'Sin aula'} -{' '}
                      {student.enrollmentStatus ?? 'sin matrícula'} - Período{' '}
                      {student.academicTerm ?? 'n/d'}
                    </p>
                  </div>
                  <Button
                    disabled={downloadId === student.studentId}
                    onClick={() => void downloadReport(student.studentId, student.reportUrl)}
                    variant="secondary"
                  >
                    {downloadId === student.studentId ? 'Preparando…' : 'Informe PDF'}
                  </Button>
                </div>

                <div className="student-snapshot-grid">
                  <div>
                    <span>Promedio</span>
                    <strong>{student.average.average ?? 'n/d'}</strong>
                  </div>
                  <div>
                    <span>Presente</span>
                    <strong>{student.attendance.present}</strong>
                  </div>
                  <div>
                    <span>Tardanza</span>
                    <strong>{student.attendance.late}</strong>
                  </div>
                  <div>
                    <span>Ausente</span>
                    <strong>{student.attendance.absent}</strong>
                  </div>
                </div>

                <div className="grade-chip-list" aria-label={`${student.fullName}: calificaciones recientes`}>
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
              <PanelState
                message={dashboard ? 'No se encontraron estudiantes vinculados en este colegio.' : 'Cargando estudiantes vinculados…'}
                tone={dashboard ? 'empty' : 'loading'}
              />
            ) : null}
          </section>

          <section className="portal-band">
            <article className="card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Próximas tareas</p>
                  <h2 className="section-title">Tareas y exámenes</h2>
                </div>
              </div>
              <div className="activity-list">
                {(dashboard?.upcomingAssignments ?? []).map((assignment) => (
                  <article className="activity-row" key={assignment.id}>
                    <ActivityMark kind={getAssignmentActivityKind(assignment.type)} />
                    <span>
                      <strong>{assignment.title}</strong>
                      <p className="field-help">
                        {assignment.classroomName ?? 'Aula'} -{' '}
                        {assignment.dueDate ? assignment.dueDate.slice(0, 10) : 'Sin fecha de entrega'}
                      </p>
                    </span>
                  </article>
                ))}
                {dashboard ? null : (
                  <PanelState message="Cargando tareas y exámenes…" tone="loading" />
                )}
                {dashboard && dashboard.upcomingAssignments.length === 0 ? (
                  <PanelState message="No hay tareas ni exámenes próximos." />
                ) : null}
              </div>
            </article>

            <article className="card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Pagos</p>
                  <h2 className="section-title">Saldo pendiente</h2>
                </div>
              </div>
              <div className="activity-list">
                {(dashboard?.balances ?? [])
                  .filter((balance) => balance.outstandingCents > 0)
                  .map((balance) => (
                    <article className="activity-row" key={balance.studentId}>
                      <ActivityMark kind="calendar" />
                      <span>
                        <strong>{balance.studentName}</strong>
                        <p className="field-help">
                          Pendiente {formatCents(balance.outstandingCents)} -{' '}
                          {balance.overdueCount} vencidos
                        </p>
                      </span>
                    </article>
                  ))}
                {(dashboard?.payments ?? [])
                  .filter((payment) => payment.status === 'pending')
                  .map((payment) => (
                    <article className="activity-row" key={payment.id}>
                      <ActivityMark kind="calendar" />
                      <span>
                        <strong>{payment.concept}</strong>
                        <p className="field-help">
                          {formatCents(payment.amountCents)} -{' '}
                          {payment.dueDate
                            ? `vence ${payment.dueDate.slice(0, 10)}`
                            : 'sin fecha de vencimiento'}
                        </p>
                      </span>
                    </article>
                  ))}
                {dashboard && dashboard.payments.length === 0 ? (
                  <PanelState message="No hay pagos pendientes." />
                ) : null}
              </div>
            </article>

            <article className="card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Calendario y bandeja de entrada</p>
                  <h2 className="section-title">Próximamente</h2>
                </div>
              </div>
              <div className="activity-list">
                {(dashboard?.upcomingEvents ?? []).map((event) => (
                  <article className="activity-row" key={event.id}>
                    <ActivityMark kind="calendar" />
                    <span>
                      <strong>{event.title}</strong>
                      <p className="field-help">
                        {event.classroomName ?? 'Todo el colegio'} - {event.startsAt.slice(0, 10)}
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
                      {message.readAt ? 'Leído' : 'Marcar como leído'}
                    </Button>
                  </article>
                ))}
                {dashboard ? null : (
                  <PanelState message="Cargando calendario y bandeja de entrada…" tone="loading" />
                )}
                {dashboard &&
                dashboard.upcomingEvents.length === 0 &&
                dashboard.recentMessages.length === 0 ? (
                  <PanelState message="Todavía no hay eventos ni mensajes." />
                ) : null}
              </div>
            </article>
          </section>

          <section className="card section-stack">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Mensaje</p>
                <h2 className="section-title">Enviar una nota a la familia</h2>
              </div>
            </div>
            <div className="workflow-inline-form">
              <FormField label="ID de usuario destinatario" name="parentRecipientUserId" onChange={(event) => setRecipientUserId(event.target.value)} value={recipientUserId} />
              <FormField label="Asunto" name="parentMessageSubject" onChange={(event) => setMessageSubject(event.target.value)} value={messageSubject} />
              <TextAreaField label="Mensaje" name="parentMessageBody" onChange={(event) => setMessageBody(event.target.value)} rows={3} value={messageBody} />
              <Button disabled={savingWorkflow === 'message' || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()} onClick={() => void sendMessage()}>
                {savingWorkflow === 'message' ? 'Enviando…' : 'Enviar mensaje'}
              </Button>
            </div>
          </section>

          <section className="card card-soft portal-band">
            <div>
              <p className="eyebrow">Notificaciones</p>
              <h2 className="section-title">Novedades del colegio</h2>
            </div>
            <div className="activity-list">
              {(dashboard?.recentNotifications ?? []).map((notification) => (
                <article className="activity-row activity-row-action" data-unread={!notification.readAt} key={notification.id}>
                  <ActivityMark kind="notification" />
                  <span>
                    <strong>{notification.title}</strong>
                    <p className="field-help">
                      {notification.message} - {notification.readAt ? 'leída' : 'sin leer'}
                    </p>
                  </span>
                  <Button
                    disabled={Boolean(notification.readAt) || savingWorkflow === notification.id}
                    onClick={() => void markNotificationRead(notification.id)}
                    variant="secondary"
                  >
                    {notification.readAt ? 'Leída' : 'Marcar como leída'}
                  </Button>
                </article>
              ))}
              {dashboard ? null : (
                <PanelState message="Cargando novedades del colegio…" tone="loading" />
              )}
              {dashboard && dashboard.recentNotifications.length === 0 ? (
                <PanelState message="Todavía no hay novedades del colegio." />
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
