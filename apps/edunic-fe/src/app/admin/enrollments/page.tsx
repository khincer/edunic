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

const enrollmentStatusLabels: Record<string, string> = {
  active: 'Activas',
  completed: 'Completadas',
  withdrawn: 'Retiradas',
};

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadEnrollments(status);
  }, []);

  async function loadEnrollments(nextStatus = status) {


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
        {}
      );
      setEnrollments(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de matrículas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Matrículas</p>
          <h1 className="page-title">Listado de matrículas</h1>
          <p className="body-copy">Revise las matrículas activas, completadas y retiradas de los estudiantes.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Filtrar</p>
            <h2 className="section-title">{enrollments.length} registros coincidentes</h2>
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
                {enrollmentStatusLabels[nextStatus] ?? nextStatus}
              </Button>
            ))}
          </div>
        </div>
        {loading ? <p className="body-copy">Cargando matrículas…</p> : null}
        {!loading && enrollments.length === 0 ? (
          <div className="empty-state body-copy">No se encontraron matrículas.</div>
        ) : null}
        <div className="activity-list">
          {enrollments.map((enrollment) => (
            <article className="activity-row" key={enrollment.id}>
              <span className="activity-mark">{enrollment.student.fullName.slice(0, 1)}</span>
              <span>
                <strong>{enrollment.student.fullName}</strong>
                <p className="field-help">
                  {enrollmentStatusLabels[enrollment.status] ?? enrollment.status} - aula {enrollment.classroomId ?? 'sin asignar'} - período{' '}
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
