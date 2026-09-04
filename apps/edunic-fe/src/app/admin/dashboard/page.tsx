'use client';

import { useEffect, useState } from 'react';
import { ActivityMark, getAssignmentActivityKind } from '@/components/activity-mark';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  formatDate,
  type AdminDashboard,
  type ApiSingleResponse,
} from '@/lib/api';
import { getSession } from '@/lib/auth';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNotificationId, setSavingNotificationId] = useState('');

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    const session = getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<AdminDashboard>>(
        '/dashboard/admin',
        { institutionId: session.user.institutionId }
      );
      setDashboard(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    const session = getSession();

    if (!session) {
      return;
    }

    setSavingNotificationId(notificationId);
    setError('');

    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
        institutionId: session.user.institutionId,
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark notification read');
    } finally {
      setSavingNotificationId('');
    }
  }

  const attendance = dashboard?.attendanceToday;
  const modules = dashboard?.modules ?? [];
  const activeModules = modules.filter((module) => module.enabled);

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Demo command center</p>
          <h1 className="page-title">
            {dashboard?.institution.name ?? 'Institution dashboard'}
          </h1>
          <p className="body-copy">
            Every showcase module is surfaced here with live tenant-scoped data.
          </p>
        </div>
        <div className="button-row">
          <ButtonLink href="/admin/institutions">Institutions</ButtonLink>
          <ButtonLink href="/admin/institutions/new" variant="secondary">
            New school
          </ButtonLink>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="dashboard-stat-grid">
        <Card className="dashboard-stat-card metric-card">
          <p className="eyebrow">Students</p>
          <p className="metric">{loading ? '...' : dashboard?.counts.students ?? 0}</p>
          <p className="body-copy">
            {dashboard?.counts.activeEnrollments ?? 0} active enrollments across{' '}
            {dashboard?.counts.classrooms ?? 0} classrooms
          </p>
        </Card>
        <Card className="dashboard-stat-card metric-card">
          <p className="eyebrow">Today attendance</p>
          <p className="metric">{loading ? '...' : attendance?.marked ?? 0}</p>
          <p className="body-copy">
            {attendance?.present ?? 0} present, {attendance?.late ?? 0} late,{' '}
            {attendance?.absent ?? 0} absent
          </p>
        </Card>
        <Card className="dashboard-stat-card metric-card" tone="dark">
          <p className="eyebrow">Grade progress</p>
          <p className="metric">{loading ? '...' : `${dashboard?.gradeSubmission.percent ?? 0}%`}</p>
          <p className="body-copy muted-on-dark">
            {dashboard?.gradeSubmission.submitted ?? 0} of{' '}
            {dashboard?.gradeSubmission.total ?? 0} active enrollments have grades
          </p>
        </Card>
      </section>

      <section className="dashboard-stat-grid section-stack">
        <Card className="dashboard-stat-card metric-card">
          <p className="eyebrow">Assignments</p>
          <p className="metric">{loading ? '...' : dashboard?.upcomingAssignments.length ?? 0}</p>
          <p className="body-copy">published homework and exams coming up</p>
        </Card>
        <Card className="dashboard-stat-card metric-card">
          <p className="eyebrow">Events</p>
          <p className="metric">{loading ? '...' : dashboard?.upcomingEvents.length ?? 0}</p>
          <p className="body-copy">school and classroom calendar items</p>
        </Card>
        <Card className="dashboard-stat-card metric-card">
          <p className="eyebrow">Messages</p>
          <p className="metric">{loading ? '...' : dashboard?.unreadMessages ?? 0}</p>
          <p className="body-copy">unread messages for this admin account</p>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
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
                    {assignment.classroomName ?? 'School-wide'} -{' '}
                    {assignment.dueDate ? formatDate(assignment.dueDate) : 'No due date'}
                  </p>
                </span>
              </article>
            ))}
            {loading ? <PanelState message="Loading assignments..." tone="loading" /> : null}
            {!loading && dashboard?.upcomingAssignments.length === 0 ? (
              <PanelState message="No upcoming assignments or exams." />
            ) : null}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Calendar</p>
              <h2 className="section-title">Upcoming events</h2>
            </div>
          </div>
          <div className="activity-list">
            {(dashboard?.upcomingEvents ?? []).map((event) => (
              <article className="activity-row" key={event.id}>
                <ActivityMark kind="calendar" />
                <span>
                  <strong>{event.title}</strong>
                  <p className="field-help">
                    {event.classroomName ?? 'School-wide'} - {formatDate(event.startsAt)}
                  </p>
                </span>
              </article>
            ))}
            {loading ? <PanelState message="Loading events..." tone="loading" /> : null}
            {!loading && dashboard?.upcomingEvents.length === 0 ? (
              <PanelState message="No upcoming calendar items." />
            ) : null}
          </div>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Modules</p>
              <h2 className="section-title">Showcase surface</h2>
            </div>
            <span className="badge badge-green">{activeModules.length} active</span>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <div className="module-row" key={`${module.type}-${module.key}`}>
                <span className={module.enabled ? 'status-dot status-dot-on' : 'status-dot'} />
                <span>
                  <strong>{module.name}</strong>
                  <p className="field-help">{module.type} - {module.source}</p>
                </span>
                <span className={module.enabled ? 'badge badge-green' : 'badge'}>
                  {module.enabled ? 'Active' : 'Off'}
                </span>
              </div>
            ))}
            {loading ? <PanelState message="Loading module status..." tone="loading" /> : null}
            {!loading && modules.length === 0 ? (
              <PanelState message="No modules are configured for this institution." />
            ) : null}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Academic period</p>
              <h2 className="section-title">
                {dashboard?.activePeriod?.label ?? 'No active period'}
              </h2>
            </div>
          </div>
          <div className="timeline-list">
            <div className="timeline-row">
              <span>Families</span>
              <strong>{dashboard?.counts.parents ?? 0} parent accounts</strong>
            </div>
            <div className="timeline-row">
              <span>Guardians</span>
              <strong>{dashboard?.counts.guardians ?? 0} linked guardians</strong>
            </div>
            <div className="timeline-row">
              <span>Teachers</span>
              <strong>{dashboard?.counts.teachers ?? 0} teaching users</strong>
            </div>
            <div className="timeline-row">
              <span>Period dates</span>
              <strong>{formatPeriodDates(dashboard)}</strong>
            </div>
            {loading ? <PanelState message="Loading academic period..." tone="loading" /> : null}
          </div>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2 className="section-title">Recent school signals</h2>
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
                  disabled={Boolean(notification.readAt) || savingNotificationId === notification.id}
                  onClick={() => void markNotificationRead(notification.id)}
                  variant="secondary"
                >
                  {notification.readAt ? 'Read' : 'Mark read'}
                </Button>
              </article>
            ))}
            {!loading && dashboard?.recentNotifications.length === 0 ? (
              <PanelState message="No notifications yet." />
            ) : null}
            {loading ? <PanelState message="Loading notifications..." tone="loading" /> : null}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h2 className="section-title">Recent activity</h2>
            </div>
          </div>
          <div className="activity-list">
            {(dashboard?.recentAuditActivity ?? []).map((activity) => (
              <article className="activity-row" key={activity.id}>
                <ActivityMark kind="audit" />
                <span>
                  <strong>{activity.action} {activity.entity}</strong>
                  <p className="field-help">
                    {activity.createdAt ? formatDate(activity.createdAt) : 'No timestamp'}
                  </p>
                </span>
              </article>
            ))}
            {!loading && dashboard?.recentAuditActivity.length === 0 ? (
              <PanelState message="No audit activity yet." />
            ) : null}
            {loading ? <PanelState message="Loading audit activity..." tone="loading" /> : null}
          </div>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Messages</p>
              <h2 className="section-title">Recent inbox</h2>
            </div>
          </div>
          <div className="activity-list">
            {(dashboard?.recentMessages ?? []).map((message) => (
              <article className="activity-row" key={message.id}>
                <ActivityMark kind="message" />
                <span>
                  <strong>{message.subject}</strong>
                  <p className="field-help">{message.body}</p>
                </span>
              </article>
            ))}
            {!loading && dashboard?.recentMessages.length === 0 ? (
              <PanelState message="No messages yet." />
            ) : null}
            {loading ? <PanelState message="Loading messages..." tone="loading" /> : null}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Reports</p>
              <h2 className="section-title">Recent history</h2>
            </div>
            <ButtonLink href="/admin/reports" variant="secondary">
              Open reports
            </ButtonLink>
          </div>
          <div className="activity-list">
            {(dashboard?.reportHistory ?? []).map((report) => (
              <article className="activity-row" key={report.id}>
                <ActivityMark kind="report" />
                <span>
                  <strong>{report.studentName}</strong>
                  <p className="field-help">
                    {report.reportType} - {report.year}
                  </p>
                </span>
              </article>
            ))}
            {loading ? <PanelState message="Loading report history..." tone="loading" /> : null}
            {!loading && dashboard?.reportHistory.length === 0 ? (
              <PanelState message="No reports have been generated yet." />
            ) : null}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}

function formatPeriodDates(dashboard: AdminDashboard | null) {
  const period = dashboard?.activePeriod;

  if (!period?.startDate || !period.endDate) {
    return 'Dates pending';
  }

  return `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`;
}
