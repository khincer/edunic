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
  type AcademicPeriod,
  type ApiListResponse,
  type ApiSingleResponse,
} from '@/lib/api';
import { getSession } from '@/lib/auth';

export default function AdminAcademicPeriodsPage() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [term, setTerm] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadPeriods();
  }, []);

  async function loadPeriods() {
    const session = getSession();

    if (!session) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiListResponse<AcademicPeriod>>(
        `/academic-periods${buildQuery({ limit: 50, sortBy: 'year', sortOrder: 'desc' })}`,
        { institutionId: session.user.institutionId }
      );
      setPeriods(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load academic periods');
    } finally {
      setLoading(false);
    }
  }

  async function createPeriod() {
    const session = getSession();

    if (!session) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<AcademicPeriod>>('/academic-periods', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          year: Number(year),
          term: Number(term),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      await loadPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create academic period');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Academic periods</p>
          <h1 className="page-title">School calendar terms</h1>
          <p className="body-copy">Create and review tenant-scoped academic years and terms.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2 className="section-title">New period</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Year" name="year" onChange={(event) => setYear(event.target.value)} type="number" value={year} />
            <FormField label="Term" max={4} min={1} name="term" onChange={(event) => setTerm(event.target.value)} type="number" value={term} />
            <FormField label="Start date" name="startDate" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            <FormField label="End date" name="endDate" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            <Button disabled={saving} onClick={() => void createPeriod()}>
              {saving ? 'Creating...' : 'Create period'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">List</p>
              <h2 className="section-title">{periods.length} periods</h2>
            </div>
            <Button onClick={() => void loadPeriods()} variant="secondary">Refresh</Button>
          </div>
          {loading ? <p className="body-copy">Loading periods...</p> : null}
          {!loading && periods.length === 0 ? <div className="empty-state body-copy">No academic periods found.</div> : null}
          <div className="activity-list">
            {periods.map((period) => (
              <article className="activity-row" key={period.id}>
                <span className="activity-mark">T{period.term}</span>
                <span>
                  <strong>{period.year} Term {period.term}</strong>
                  <p className="field-help">
                    {period.startDate ? formatDate(period.startDate) : 'No start'} - {period.endDate ? formatDate(period.endDate) : 'No end'}
                  </p>
                </span>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
