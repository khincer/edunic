'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  buildQuery,
  formatDate,
  type ApiListResponse,
  type ApiSingleResponse,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/lib/api';

const attendanceStatusLabels: Record<string, string> = {
  present: 'Presente',
  late: 'Tardanza',
  absent: 'Ausente',
};

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadAttendance(status);
  }, []);

  async function loadAttendance(nextStatus = status) {


    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        status: nextStatus || undefined,
        limit: 50,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      const result = await apiRequest<ApiListResponse<AttendanceRecord>>(
        `/attendance${query}`,
        {}
      );
      setRecords(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la asistencia');
    } finally {
      setLoading(false);
    }
  }

  async function createAttendance() {

    if (!enrollmentId.trim()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<AttendanceRecord>>('/attendance', {
        method: 'POST',
        body: {
          enrollmentId,
          date,
          status: newStatus,
        },
      });
      await loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la asistencia');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Asistencia</p>
          <h1 className="page-title">Registro diario de asistencia</h1>
          <p className="body-copy">Filtre los registros de asistencia y agregue marcas.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filtrar</p>
              <h2 className="section-title">Estado</h2>
            </div>
          </div>
          <div className="button-row">
            {['', 'present', 'late', 'absent'].map((nextStatus) => (
              <Button
                key={nextStatus || 'all'}
                onClick={() => {
                  setStatus(nextStatus as AttendanceStatus | '');
                  void loadAttendance(nextStatus as AttendanceStatus | '');
                }}
                variant={status === nextStatus ? 'primary' : 'secondary'}
              >
                {nextStatus ? attendanceStatusLabels[nextStatus] : 'Todas'}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Crear</p>
              <h2 className="section-title">Nueva marca</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="ID de matrícula" name="attendanceEnrollmentId" onChange={(event) => setEnrollmentId(event.target.value)} value={enrollmentId} />
            <FormField label="Fecha" name="attendanceDate" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
            <label className="form-field" htmlFor="attendanceStatus">
              <span>Estado</span>
              <select id="attendanceStatus" onChange={(event) => setNewStatus(event.target.value as AttendanceStatus)} value={newStatus}>
                <option value="present">Presente</option>
                <option value="late">Tardanza</option>
                <option value="absent">Ausente</option>
              </select>
            </label>
            <Button disabled={saving || !enrollmentId.trim()} onClick={() => void createAttendance()}>
              {saving ? 'Registrando…' : 'Registrar asistencia'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Registros</p>
            <h2 className="section-title">{records.length} marcas</h2>
          </div>
        </div>
        {loading ? <p className="body-copy">Cargando asistencia…</p> : null}
        {!loading && records.length === 0 ? <div className="empty-state body-copy">No se encontraron registros de asistencia.</div> : null}
        <div className="activity-list">
          {records.map((record) => (
            <article className="activity-row" key={record.id}>
              <span className="activity-mark">{record.status.slice(0, 1)}</span>
              <span>
                <strong>{attendanceStatusLabels[record.status] ?? record.status}</strong>
                <p className="field-help">
                  Matrícula {record.enrollmentId} - {formatDate(record.date)}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
