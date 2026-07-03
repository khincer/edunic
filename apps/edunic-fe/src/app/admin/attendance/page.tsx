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
import { getSession } from '@/lib/auth';

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
    const session = getSession();

    if (!session) {
      return;
    }

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
        { institutionId: session.user.institutionId }
      );
      setRecords(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attendance');
    } finally {
      setLoading(false);
    }
  }

  async function createAttendance() {
    const session = getSession();

    if (!session || !enrollmentId.trim()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<AttendanceRecord>>('/attendance', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          enrollmentId,
          date,
          status: newStatus,
        },
      });
      await loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create attendance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1 className="page-title">Daily attendance marks</h1>
          <p className="body-copy">Filter attendance and create demo marks through the existing API.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filter</p>
              <h2 className="section-title">Status</h2>
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
                {nextStatus || 'all'}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2 className="section-title">New mark</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Enrollment ID" name="attendanceEnrollmentId" onChange={(event) => setEnrollmentId(event.target.value)} value={enrollmentId} />
            <FormField label="Date" name="attendanceDate" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
            <label className="form-field" htmlFor="attendanceStatus">
              <span>Status</span>
              <select id="attendanceStatus" onChange={(event) => setNewStatus(event.target.value as AttendanceStatus)} value={newStatus}>
                <option value="present">present</option>
                <option value="late">late</option>
                <option value="absent">absent</option>
              </select>
            </label>
            <Button disabled={saving || !enrollmentId.trim()} onClick={() => void createAttendance()}>
              {saving ? 'Marking...' : 'Mark attendance'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Records</p>
            <h2 className="section-title">{records.length} marks</h2>
          </div>
        </div>
        {loading ? <p className="body-copy">Loading attendance...</p> : null}
        {!loading && records.length === 0 ? <div className="empty-state body-copy">No attendance records found.</div> : null}
        <div className="activity-list">
          {records.map((record) => (
            <article className="activity-row" key={record.id}>
              <span className="activity-mark">{record.status.slice(0, 1)}</span>
              <span>
                <strong>{record.status}</strong>
                <p className="field-help">
                  Enrollment {record.enrollmentId} - {formatDate(record.date)}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
