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


    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiListResponse<AcademicPeriod>>(
        `/academic-periods${buildQuery({ limit: 50, sortBy: 'year', sortOrder: 'desc' })}`,
        {}
      );
      setPeriods(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los períodos académicos');
    } finally {
      setLoading(false);
    }
  }

  async function createPeriod() {


    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<AcademicPeriod>>('/academic-periods', {
        method: 'POST',
        body: {
          year: Number(year),
          term: Number(term),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      await loadPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el período académico');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Períodos académicos</p>
          <h1 className="page-title">Calendario escolar</h1>
          <p className="body-copy">Años y períodos académicos del colegio.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Crear</p>
              <h2 className="section-title">Nuevo período</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Año" name="year" onChange={(event) => setYear(event.target.value)} type="number" value={year} />
            <FormField label="Período" max={4} min={1} name="term" onChange={(event) => setTerm(event.target.value)} type="number" value={term} />
            <FormField label="Fecha de inicio" name="startDate" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
            <FormField label="Fecha de fin" name="endDate" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            <Button disabled={saving} onClick={() => void createPeriod()}>
              {saving ? 'Creando…' : 'Crear período'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 className="section-title">{periods.length} períodos</h2>
            </div>
            <Button onClick={() => void loadPeriods()} variant="secondary">Actualizar</Button>
          </div>
          {loading ? <p className="body-copy">Cargando períodos…</p> : null}
          {!loading && periods.length === 0 ? <div className="empty-state body-copy">No se encontraron períodos académicos.</div> : null}
          <div className="activity-list">
            {periods.map((period) => (
              <article className="activity-row" key={period.id}>
                <span className="activity-mark">T{period.term}</span>
                <span>
                  <strong>{period.year} Período {period.term}</strong>
                  <p className="field-help">
                    {period.startDate ? formatDate(period.startDate) : 'Sin inicio'} - {period.endDate ? formatDate(period.endDate) : 'Sin fin'}
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
