'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  formatDate,
  type AdminDashboard,
  type ApiListResponse,
  type ApiSingleResponse,
  type Student,
} from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { getSession } from '@/lib/auth';

export default function AdminReportsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [busyStudentId, setBusyStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadReports();
  }, []);

  async function loadReports() {
    const session = getSession();

    if (!session) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [studentResult, dashboardResult] = await Promise.all([
        apiRequest<ApiListResponse<Student>>('/students?limit=100&sortBy=lastName&sortOrder=asc', {
          institutionId: session.user.institutionId,
        }),
        apiRequest<ApiSingleResponse<AdminDashboard>>('/dashboard/admin', {
          institutionId: session.user.institutionId,
        }),
      ]);
      setStudents(studentResult.data);
      setDashboard(dashboardResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function downloadReport(studentId: string) {
    const session = getSession();

    if (!session) {
      return;
    }

    const year = dashboard?.activePeriod?.year ?? new Date().getFullYear();
    setBusyStudentId(studentId);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/reports/students/${studentId}/academic-summary/pdf?year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
            'x-institution-id': session.user.institutionId,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Unable to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-report-${studentId}-${year}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download report');
    } finally {
      setBusyStudentId('');
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 className="page-title">Academic summaries</h1>
          <p className="body-copy">Review generated report history and download student PDFs.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Students</p>
              <h2 className="section-title">{loading ? 'Loading' : `${students.length} available`}</h2>
            </div>
          </div>
          <div className="activity-list">
            {students.map((student) => (
              <article className="module-row" key={student.id}>
                <span className="activity-mark">{student.firstName.slice(0, 1)}</span>
                <span>
                  <strong>{student.fullName}</strong>
                  <p className="field-help">{student.dateOfBirth ?? 'No birth date'}</p>
                </span>
                <Button
                  disabled={busyStudentId === student.id}
                  onClick={() => void downloadReport(student.id)}
                  variant="secondary"
                >
                  {busyStudentId === student.id ? 'Preparing...' : 'PDF'}
                </Button>
              </article>
            ))}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">History</p>
              <h2 className="section-title">Generated reports</h2>
            </div>
          </div>
          <div className="activity-list">
            {(dashboard?.reportHistory ?? []).map((report) => (
              <article className="activity-row" key={report.id}>
                <span className="activity-mark">R</span>
                <span>
                  <strong>{report.studentName}</strong>
                  <p className="field-help">
                    {report.reportType} - {report.year} -{' '}
                    {report.createdAt ? formatDate(report.createdAt) : 'No timestamp'}
                  </p>
                </span>
              </article>
            ))}
            {!loading && dashboard?.reportHistory.length === 0 ? (
              <div className="empty-state body-copy">No report history yet.</div>
            ) : null}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
