'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DataTable } from '@/components/data-table';
import { FormField } from '@/components/form-field';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  buildQuery,
  formatClassroom,
  formatDate,
  type ApiSingleResponse,
  type ClassroomActivity,
  type ClassroomActivityItem,
  type ClassroomActivitySummary,
} from '@/lib/api';

const TYPE_LABELS: Record<ClassroomActivityItem['type'], string> = {
  grade: 'Grade',
  attendance: 'Attendance',
  assignment: 'Assignment',
  event: 'Event',
};

function defaultSince() {
  const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

// ROLE-03 / ROLE-04: the director follows what every classroom recorded in a
// window (grades, attendance, assignments, events) and opens one classroom
// for its totals and latest entries.
export default function AdminClassroomActivityPage() {
  const [since, setSince] = useState(defaultSince);
  const [summary, setSummary] = useState<ClassroomActivitySummary | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ClassroomActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSummary(since);
    // Reload on demand (Apply), not on every keystroke of the date.
  }, []);

  useEffect(() => {
    void loadDetail(selectedId, since);
    // The detail follows the selection; the window is applied with Apply.
  }, [selectedId]);

  async function loadSummary(from: string) {
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<ClassroomActivitySummary>>(
        `/classrooms/activity${buildQuery({ since: from })}`
      );
      setSummary(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load classroom activity');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(classroomId: string, from: string) {
    if (!classroomId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<ClassroomActivity>>(
        `/classrooms/${classroomId}/activity${buildQuery({ since: from, limit: 30 })}`
      );
      setDetail(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the classroom');
    } finally {
      setDetailLoading(false);
    }
  }

  function apply() {
    void loadSummary(since);
    void loadDetail(selectedId, since);
  }

  const classrooms = summary?.classrooms ?? [];

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Activity</p>
          <h1 className="page-title">Classroom activity</h1>
          <p className="body-copy">
            What each classroom recorded since a date: grades, attendance, assignments and events.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card className="filter-panel">
        <div className="form form-action-row button-row">
          <FormField
            label="Since"
            name="activitySince"
            onChange={(event) => setSince(event.target.value)}
            type="date"
            value={since}
          />
          <Button disabled={!since} onClick={apply}>
            Apply
          </Button>
        </div>
      </Card>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">All classrooms</p>
            <h2 className="section-title">
              {classrooms.length} {classrooms.length === 1 ? 'classroom' : 'classrooms'}
            </h2>
          </div>
        </div>
        {loading ? (
          <PanelState message="Loading activity..." tone="loading" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'classroom',
                header: 'Classroom',
                render: (row) => <strong>{formatClassroom(row)}</strong>,
              },
              { key: 'teachers', header: 'Teachers', align: 'right', render: (row) => row.teacherCount },
              { key: 'students', header: 'Students', align: 'right', render: (row) => row.activeStudents },
              { key: 'grades', header: 'Grades', align: 'right', render: (row) => row.gradesRecorded },
              {
                key: 'attendance',
                header: 'Attendance',
                align: 'right',
                render: (row) => `${row.attendanceMarked} (${row.absences} absent)`,
              },
              { key: 'assignments', header: 'Assignments', align: 'right', render: (row) => row.assignmentsCreated },
              { key: 'events', header: 'Events', align: 'right', render: (row) => row.eventsScheduled },
              {
                key: 'last',
                header: 'Last activity',
                render: (row) =>
                  row.lastActivityAt ? (
                    formatDate(row.lastActivityAt)
                  ) : (
                    <span className="badge badge-red">Never</span>
                  ),
              },
              {
                key: 'open',
                header: '',
                align: 'right',
                render: (row) => (
                  <Button
                    onClick={() => setSelectedId(row.classroomId)}
                    variant={row.classroomId === selectedId ? 'primary' : 'ghost'}
                  >
                    Details
                  </Button>
                ),
              },
            ]}
            emptyMessage="No classrooms yet."
            getRowKey={(row) => row.classroomId}
            rows={classrooms}
          />
        )}
      </section>

      {selectedId ? (
        <section className="section-stack">
          {detailLoading || !detail ? (
            <PanelState message="Loading the classroom..." tone="loading" />
          ) : (
            <>
              <section className="dashboard-stat-grid">
                <Card className="metric-card">
                  <p className="eyebrow">{formatClassroom(detail.classroom)}</p>
                  <p className="metric">{detail.totals.activeStudents}</p>
                  <p className="body-copy">active students</p>
                </Card>
                <Card className="metric-card">
                  <p className="eyebrow">Grades</p>
                  <p className="metric">{detail.totals.gradesRecorded}</p>
                  <p className="body-copy">
                    {detail.totals.gradeAverage === null
                      ? 'No average yet'
                      : `Average ${detail.totals.gradeAverage}`}
                  </p>
                </Card>
                <Card className="metric-card">
                  <p className="eyebrow">Attendance</p>
                  <p className="metric">{detail.totals.attendanceMarked}</p>
                  <p className="body-copy">
                    {detail.totals.absences} absent, {detail.totals.lates} late,{' '}
                    {detail.totals.assignmentsCreated} assignments, {detail.totals.eventsScheduled} events
                  </p>
                </Card>
              </section>
              <section className="card section-stack">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Latest</p>
                    <h2 className="section-title">Recent activity</h2>
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: 'when', header: 'When', render: (item) => formatDate(item.occurredAt) },
                    {
                      key: 'type',
                      header: 'Type',
                      render: (item) => <span className="badge badge-blue">{TYPE_LABELS[item.type]}</span>,
                    },
                    { key: 'student', header: 'Student', render: (item) => item.studentName ?? '-' },
                    { key: 'summary', header: 'Detail', render: (item) => item.summary },
                  ]}
                  emptyMessage="Nothing recorded in this window."
                  getRowKey={(item) => `${item.type}-${item.id}`}
                  rows={detail.recent}
                />
              </section>
            </>
          )}
        </section>
      ) : null}
    </AdminShell>
  );
}
