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
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
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
      setError(err instanceof Error ? err.message : 'Unable to mark notification read');
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
          <h1 className="page-title">{dashboard?.institution.name ?? 'Dashboard'}</h1>
          <p className="body-copy">{describePeriod(dashboard)}</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section aria-label="Key figures" className="kpi-strip">
        <div className="kpi">
          <span className="kpi-label">Students</span>
          <span className="kpi-value">{value(counts?.students)}</span>
          <span className="kpi-meta">
            {value(counts?.activeEnrollments)} enrolled · {value(counts?.classrooms)} classrooms
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Teachers</span>
          <span className="kpi-value">{value(counts?.teachers)}</span>
          <span className="kpi-meta">
            {value(counts?.parents)} parent accounts · {value(counts?.guardians)} guardians
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Attendance today</span>
          <span className="kpi-value">{value(attendance?.marked)}</span>
          <span className="kpi-meta">
            {value(attendance?.present)} present · {value(attendance?.late)} late ·{' '}
            {value(attendance?.absent)} absent
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Grades submitted</span>
          <span className="kpi-value">{loading || !grades ? '—' : `${grades.percent}%`}</span>
          <span className="kpi-meta">
            {value(grades?.submitted)} of {value(grades?.total)} enrollments
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
        <Panel href="/admin/workflows" title="Upcoming assignments">
          {(dashboard?.upcomingAssignments ?? []).map((assignment) => (
            <article className="activity-row" key={assignment.id}>
              <ActivityMark kind={getAssignmentActivityKind(assignment.type)} />
              <span>
                <strong>{assignment.title}</strong>
                <p className="field-help">
                  {assignment.classroomName ?? 'School-wide'} ·{' '}
                  {assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : 'No due date'}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="No upcoming assignments or exams."
            isEmpty={dashboard?.upcomingAssignments.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/workflows" title="Upcoming events">
          {(dashboard?.upcomingEvents ?? []).map((event) => (
            <article className="activity-row" key={event.id}>
              <ActivityMark kind="calendar" />
              <span>
                <strong>{event.title}</strong>
                <p className="field-help">
                  {event.classroomName ?? 'School-wide'} · {formatDate(event.startsAt)}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="No upcoming events."
            isEmpty={dashboard?.upcomingEvents.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/notifications" title="Notifications">
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
                <span className="activity-row-meta">Read</span>
              ) : (
                <Button
                  className="button-small"
                  disabled={savingNotificationId === notification.id}
                  onClick={() => void markNotificationRead(notification.id)}
                  variant="secondary"
                >
                  Mark read
                </Button>
              )}
            </article>
          ))}
          <ListState
            empty="No notifications."
            isEmpty={dashboard?.recentNotifications.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel
          badge={dashboard?.unreadMessages ? `${dashboard.unreadMessages} unread` : undefined}
          title="Messages"
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
            empty="No messages."
            isEmpty={dashboard?.recentMessages.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/reports" title="Recent reports">
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
            empty="No reports generated yet."
            isEmpty={dashboard?.reportHistory.length === 0}
            loading={loading}
          />
        </Panel>

        <Panel href="/admin/settings/audit-logs" title="Recent changes">
          {(dashboard?.recentAuditActivity ?? []).map((activity) => (
            <article className="activity-row" key={activity.id}>
              <ActivityMark kind="audit" />
              <span>
                <strong>{describeAudit(activity.action, activity.entity)}</strong>
                <p className="field-help">
                  {activity.createdAt ? formatDate(activity.createdAt) : 'No timestamp'}
                </p>
              </span>
            </article>
          ))}
          <ListState
            empty="No changes recorded yet."
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
            View all
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
    return <PanelState message="Loading…" tone="loading" />;
  }

  return isEmpty ? <PanelState message={empty} /> : null;
}

const auditVerbs: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
};

function describeAudit(action: string, entity: string) {
  const subject = entity.replace(/_/g, ' ');
  const verb = auditVerbs[action.toLowerCase()] ?? action;

  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${verb}`;
}

function describePeriod(dashboard: AdminDashboard | null) {
  if (!dashboard) {
    return ' ';
  }

  const period = dashboard.activePeriod;

  if (!period) {
    return 'No active academic period';
  }

  if (!period.startDate || !period.endDate) {
    return period.label;
  }

  return `${period.label} · ${formatDay(period.startDate)} – ${formatDay(period.endDate)}`;
}
