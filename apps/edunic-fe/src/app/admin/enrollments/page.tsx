'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  buildQuery,
  type ApiListResponse,
  type Enrollment,
} from '@/lib/api';
import { getSession } from '@/lib/auth';

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadEnrollments(status);
  }, []);

  async function loadEnrollments(nextStatus = status) {
    const session = getSession();

    if (!session) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        status: nextStatus,
        limit: 100,
        sortBy: 'studentName',
        sortOrder: 'asc',
      });
      const result = await apiRequest<ApiListResponse<Enrollment>>(
        `/enrollments${query}`,
        { institutionId: session.user.institutionId }
      );
      setEnrollments(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load enrollments');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Enrollments</p>
          <h1 className="page-title">Enrollment roster</h1>
          <p className="body-copy">Review active, completed, and withdrawn student enrollments.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Filter</p>
            <h2 className="section-title">{enrollments.length} matching records</h2>
          </div>
          <div className="button-row">
            {['active', 'completed', 'withdrawn'].map((nextStatus) => (
              <Button
                key={nextStatus}
                onClick={() => {
                  setStatus(nextStatus);
                  void loadEnrollments(nextStatus);
                }}
                variant={status === nextStatus ? 'primary' : 'secondary'}
              >
                {nextStatus}
              </Button>
            ))}
          </div>
        </div>
        {loading ? <p className="body-copy">Loading enrollments...</p> : null}
        {!loading && enrollments.length === 0 ? (
          <div className="empty-state body-copy">No enrollments found.</div>
        ) : null}
        <div className="activity-list">
          {enrollments.map((enrollment) => (
            <article className="activity-row" key={enrollment.id}>
              <span className="activity-mark">{enrollment.student.fullName.slice(0, 1)}</span>
              <span>
                <strong>{enrollment.student.fullName}</strong>
                <p className="field-help">
                  {enrollment.status} - classroom {enrollment.classroomId ?? 'unassigned'} - period{' '}
                  {enrollment.academicPeriodId}
                </p>
              </span>
            </article>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
