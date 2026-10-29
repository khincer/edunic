'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityMark, getAssignmentActivityKind } from '@/components/activity-mark';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  formatDate,
  formatDay,
  type AdminDashboard,
  type ApiSingleResponse,
} from '@/lib/api';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNotificationId, setSavingNotificationId] = useState('');

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<AdminDashboard>>(
        '/dashboard/admin',
        {}
      );
      setDashboard(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel principal');
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    setSavingNotificationId(notificationId);
    setError('');

    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar la notificación como leída');
    } finally {
      setSavingNotificationId('');
    }
  }

  const counts = dashboard?.counts;
  const attendance = dashboard?.attendanceToday;
  const grades = dashboard?.gradeSubmission;
  const value = (n: number | undefined) => (loading || n === undefined ? '—' : n.toLocaleString());

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <h1 className="page-title">{dashboard?.institution.name ?? 'Panel principal'}</h1>
          <p className="body-copy">{describePeriod(dashboard)}</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section aria-label="Cifras clave" className="kpi-strip">
        <div className="kpi">
          <span className="kpi-label">Estudiantes</span>
          <span className="kpi-value">{value(counts?.students)}</span>
          <span className="kpi-meta">
            {value(counts?.activeEnrollments)} matrículas · {value(counts?.classrooms)} aulas
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Docentes</span>
          <span className="kpi-value">{value(counts?.teachers)}</span>
          <span className="kpi-meta">
            {value(counts?.parents)} cuentas de familias · {value(counts?.guardians)} tutores
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Asistencia de hoy</span>
          <span className="kpi-value">{value(attendance?.marked)}</span>
          <span className="kpi-meta">
            {value(attendance?.present)} presentes · {value(attendance?.late)} tardanzas ·{' '}
            {value(attendance?.absent)} ausentes
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Calificaciones enviadas</span>
          <span className="kpi-value">{loading || !grades ? '—' : `${grades.percent}%`}</span>
          <span className="kpi-meta">
            {value(grades?.submitted)} de {value(grades?.total)} matrículas
          </span>
          <div
            aria-hidden="true"
            className="progress"
          >
            <span style={{ width: `${Math.min(grades?.percent ?? 0, 100)}%` }} />
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <Panel href="/admin/workflows" title="Tareas próximas">
          {(dashboard?.upcomingAssignments ?? []).map((assignment) => (
            <article className="activity-row" key={assignment.id}>
              <ActivityMark kind={getAssignmentActivityKind(assignment.type)} />
              <span>
                <strong>{assignment.title}</strong>
                <p className="field-help">
                  {assignment.classroomName ?? 'Todo el colegio'} ·{' '}
                  {assignment.dueDate ? `Vence el ${formatDate(assignment.dueDate)}` : 'Sin fecha de entrega'}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="No hay tareas ni exámenes próximos."
            isEmpty={dashboard?.upcomingAssignments.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/workflows" title="Eventos próximos">
          {(dashboard?.upcomingEvents ?? []).map((event) => (
            <article className="activity-row" key={event.id}>
              <ActivityMark kind="calendar" />
              <span>
                <strong>{event.title}</strong>
                <p className="field-help">
                  {event.classroomName ?? 'Todo el colegio'} · {formatDate(event.startsAt)}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="No hay eventos próximos."
            isEmpty={dashboard?.upcomingEvents.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/notifications" title="Notificaciones">
          {(dashboard?.recentNotifications ?? []).map((notification) => (
            <article
              className="activity-row activity-row-action"
              data-unread={!notification.readAt}
              key={notification.id}
            >
              <ActivityMark kind="notification" />
              <span>
                <strong>{notification.title}</strong>
                <p className="field-help">{notification.message}</p>
              </span>
              {notification.readAt ? (
                <span className="activity-row-meta">Leída</span>
              ) : (
                <Button
                  className="button-small"
                  disabled={savingNotificationId === notification.id}
                  onClick={() => void markNotificationRead(notification.id)}
                  variant="secondary"
                >
                  Marcar como leída
                </Button>
              )}
            </article>
          ))}
          <ListState
            empty="No hay notificaciones."
            isEmpty={dashboard?.recentNotifications.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel
          badge={dashboard?.unreadMessages ? `${dashboard.unreadMessages} sin leer` : undefined}
          title="Mensajes"
        >
          {(dashboard?.recentMessages ?? []).map((message) => (
            <article className="activity-row" data-unread={!message.readAt} key={message.id}>
              <ActivityMark kind="message" />
              <span>
                <strong>{message.subject}</strong>
                <p className="field-help">{message.body}</p>
              </span>
            </article>
          ))}
          <ListState
            empty="No hay mensajes."
            isEmpty={dashboard?.recentMessages.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/reports" title="Informes recientes">
          {(dashboard?.reportHistory ?? []).map((report) => (
            <article className="activity-row" key={report.id}>
              <ActivityMark kind="report" />
              <span>
                <strong>{report.studentName}</strong>
                <p className="field-help">
                  <span className="capitalize">{report.reportType}</span> · {report.year}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="Todavía no se generaron informes."
            isEmpty={dashboard?.reportHistory.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/settings/audit-logs" title="Cambios recientes">
          {(dashboard?.recentAuditActivity ?? []).map((activity) => (
            <article className="activity-row" key={activity.id}>
              <ActivityMark kind="audit" />
              <span>
                <strong>{describeAudit(activity.action, activity.entity)}</strong>
                <p className="field-help">
                  {activity.createdAt ? formatDate(activity.createdAt) : 'Sin fecha'}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="Todavía no hay cambios registrados."
            isEmpty={dashboard?.recentAuditActivity.length === 0}
            loading={loading}
          />
        </Panel>
      </section>
    </AdminShell>
  );
}

type PanelProps = {
  title: string;
  href?: string;
  badge?: string;
  children: ReactNode;
};

function Panel({ title, href, badge, children }: PanelProps) {
  return (
    <Card className="dashboard-panel">
      <div className="panel-header">
        <h2 className="section-title">{title}</h2>
        {badge ? <span className="badge badge-blue">{badge}</span> : null}
        {href ? (
          <Link className="panel-link" href={href}>
            Ver todo
          </Link>
        ) : null}
      </div>
      <div className="activity-list">{children}</div>
    </Card>
  );
}

function ListState({
  loading,
  isEmpty,
  empty,
}: {
  loading: boolean;
  isEmpty: boolean | undefined;
  empty: string;
}) {
  if (loading) {
    return <PanelState message="Cargando…" tone="loading" />;
  }

  return isEmpty ? <PanelState message={empty} /> : null;
}

const auditEntityLabels: Record<string, string> = {
  students: 'estudiante',
  student_guardians: 'tutor del estudiante',
  guardians: 'tutor',
  teachers: 'docente',
  enrollments: 'matrícula',
  subjects: 'materia',
  academic_periods: 'período académico',
  classrooms: 'aula',
  grades: 'calificación',
  attendance: 'asistencia',
  reports: 'informe',
  payments: 'pago',
  assignments: 'tarea',
  school_events: 'evento del colegio',
  messages: 'mensaje',
  notifications: 'notificación',
  feature_flags: 'funcionalidad',
  extensions: 'extensión',
  custom_fields: 'campo personalizado',
  audit_logs: 'registro de auditoría',
  users: 'usuario',
  school_profile: 'perfil del colegio',
};

const auditVerbs: Record<string, string> = {
  create: 'Alta de',
  update: 'Modificación de',
  delete: 'Baja de',
};

function describeAudit(action: string, entity: string) {
  const label = auditEntityLabels[entity] ?? entity.replace(/_/g, ' ');
  const verb = auditVerbs[action.toLowerCase()];

  return verb ? `${verb} ${label}` : `${label} · ${action}`;
}

function describePeriod(dashboard: AdminDashboard | null) {
  if (!dashboard) {
    return ' ';
  }

  const period = dashboard.activePeriod;

  if (!period) {
    return 'Sin período académico activo';
  }

  if (!period.startDate || !period.endDate) {
    return period.label;
  }

  return `${period.label} · ${formatDay(period.startDate)} – ${formatDay(period.endDate)}`;
}
