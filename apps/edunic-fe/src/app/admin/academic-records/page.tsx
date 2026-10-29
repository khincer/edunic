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

const attendanceStatusLabels: Record<string, string> = {
  present: 'Presente',
  late: 'Tardanza',
  absent: 'Ausente',
};

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


    setLoading(true);
    setError('');

    try {
      const headers = {};
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
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los registros académicos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Registros académicos</p>
          <h1 className="page-title">Períodos, calificaciones y asistencia</h1>
          <p className="body-copy">Una vista operativa en vivo de los módulos principales del registro académico.</p>
        </div>
        <Button onClick={() => void loadRecords()} variant="secondary">
          Actualizar
        </Button>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-3">
        <Card>
          <p className="eyebrow">Períodos</p>
          <p className="metric">{loading ? '...' : periods.length}</p>
          <p className="body-copy">períodos académicos configurados</p>
        </Card>
        <Card>
          <p className="eyebrow">Calificaciones</p>
          <p className="metric">{loading ? '...' : grades.length}</p>
          <p className="body-copy">calificaciones recientes</p>
        </Card>
        <Card>
          <p className="eyebrow">Asistencia</p>
          <p className="metric">{loading ? '...' : attendance.length}</p>
          <p className="body-copy">registros de asistencia recientes</p>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Calificaciones</p>
              <h2 className="section-title">Últimos envíos</h2>
            </div>
          </div>
          <div className="activity-list">
            {grades.map((grade) => (
              <article className="activity-row" key={grade.id}>
                <span className="activity-mark">{grade.score}</span>
                <span>
                  <strong>{grade.subject}</strong>
                  <p className="field-help">
                    {grade.createdAt ? formatDate(grade.createdAt) : 'Sin fecha'}
                  </p>
                </span>
              </article>
            ))}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Asistencia</p>
              <h2 className="section-title">Marcas recientes</h2>
            </div>
          </div>
          <div className="activity-list">
            {attendance.map((record) => (
              <article className="activity-row" key={record.id}>
                <span className="activity-mark">{record.status.slice(0, 1)}</span>
                <span>
                  <strong>{attendanceStatusLabels[record.status] ?? record.status}</strong>
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
