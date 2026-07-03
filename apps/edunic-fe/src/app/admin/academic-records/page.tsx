'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  buildQuery,
  formatDate,
  type AcademicPeriod,
  type ApiListResponse,
  type AttendanceRecord,
  type Grade,
} from '@/lib/api';
import { getSession } from '@/lib/auth';

export default function AdminAcademicRecordsPage() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadRecords();
  }, []);

  async function loadRecords() {
    const session = getSession();

    if (!session) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const headers = { institutionId: session.user.institutionId };
      const [periodResult, gradeResult, attendanceResult] = await Promise.all([
        apiRequest<ApiListResponse<AcademicPeriod>>(
          `/academic-periods${buildQuery({ limit: 20, sortBy: 'year', sortOrder: 'desc' })}`,
          headers
        ),
        apiRequest<ApiListResponse<Grade>>(
          `/grades${buildQuery({ limit: 20, sortBy: 'createdAt', sortOrder: 'desc' })}`,
          headers
        ),
        apiRequest<ApiListResponse<AttendanceRecord>>(
          `/attendance${buildQuery({ limit: 20, sortBy: 'date', sortOrder: 'desc' })}`,
          headers
        ),
      ]);
      setPeriods(periodResult.data);
      setGrades(gradeResult.data);
      setAttendance(attendanceResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load academic records');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Academic records</p>
          <h1 className="page-title">Periods, grades, and attendance</h1>
          <p className="body-copy">A live operational view across the core academic record modules.</p>
        </div>
        <Button onClick={() => void loadRecords()} variant="secondary">
          Refresh
        </Button>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-3">
        <Card>
          <p className="eyebrow">Periods</p>
          <p className="metric">{loading ? '...' : periods.length}</p>
          <p className="body-copy">configured academic periods</p>
        </Card>
        <Card>
          <p className="eyebrow">Grades</p>
          <p className="metric">{loading ? '...' : grades.length}</p>
          <p className="body-copy">recent grade records</p>
        </Card>
        <Card tone="dark">
          <p className="eyebrow">Attendance</p>
          <p className="metric">{loading ? '...' : attendance.length}</p>
          <p className="body-copy muted-on-dark">recent attendance records</p>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Grades</p>
              <h2 className="section-title">Latest submissions</h2>
            </div>
          </div>
          <div className="activity-list">
            {grades.map((grade) => (
              <article className="activity-row" key={grade.id}>
                <span className="activity-mark">{grade.score}</span>
                <span>
                  <strong>{grade.subject}</strong>
                  <p className="field-help">
                    {grade.createdAt ? formatDate(grade.createdAt) : 'No timestamp'}
                  </p>
                </span>
              </article>
            ))}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Attendance</p>
              <h2 className="section-title">Recent marks</h2>
            </div>
          </div>
          <div className="activity-list">
            {attendance.map((record) => (
              <article className="activity-row" key={record.id}>
                <span className="activity-mark">{record.status.slice(0, 1)}</span>
                <span>
                  <strong>{record.status}</strong>
                  <p className="field-help">{formatDate(record.date)}</p>
                </span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
