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
  type Grade,
  type Subject,
} from '@/lib/api';

export default function AdminGradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [score, setScore] = useState('90');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSubjects();
    void loadGrades();
  }, []);

  async function loadSubjects() {
    try {
      const result = await apiRequest<ApiListResponse<Subject>>('/subjects');
      setSubjects(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las materias');
    }
  }

  async function loadGrades(nextSubjectId = subjectId) {
    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        subjectId: nextSubjectId,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const result = await apiRequest<ApiListResponse<Grade>>(`/grades${query}`);
      setGrades(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las calificaciones');
    } finally {
      setLoading(false);
    }
  }

  async function createGrade() {
    if (!enrollmentId.trim() || !newSubjectId) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<Grade>>('/grades', {
        method: 'POST',
        body: {
          enrollmentId,
          subjectId: newSubjectId,
          score: Number(score),
        },
      });
      setNewSubjectId('');
      await loadGrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la calificación');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Calificaciones</p>
          <h1 className="page-title">Registro de calificaciones</h1>
          <p className="body-copy">Revise las calificaciones recientes y registre nuevas.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filtrar</p>
              <h2 className="section-title">Búsqueda por materia</h2>
            </div>
          </div>
          <div className="form">
            <label className="field" htmlFor="grade-subject-filter">
              <span className="field-label">Materia</span>
              <select
                id="grade-subject-filter"
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  void loadGrades(event.target.value);
                }}
                value={subjectId}
              >
                <option value="">Todas las materias</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Crear</p>
              <h2 className="section-title">Nueva calificación</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="ID de matrícula" name="enrollmentId" onChange={(event) => setEnrollmentId(event.target.value)} value={enrollmentId} />
            <label className="field" htmlFor="grade-subject">
              <span className="field-label">Materia</span>
              <select
                id="grade-subject"
                onChange={(event) => setNewSubjectId(event.target.value)}
                value={newSubjectId}
              >
                <option value="">Seleccione una materia</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <FormField label="Calificación" max={100} min={0} name="score" onChange={(event) => setScore(event.target.value)} type="number" value={score} />
            <Button disabled={saving || !enrollmentId.trim() || !newSubjectId} onClick={() => void createGrade()}>
              {saving ? 'Enviando…' : 'Enviar calificación'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Registros</p>
            <h2 className="section-title">{grades.length} calificaciones</h2>
          </div>
        </div>
        {loading ? <p className="body-copy">Cargando calificaciones…</p> : null}
        {!loading && grades.length === 0 ? <div className="empty-state body-copy">No se encontraron calificaciones.</div> : null}
        <div className="activity-list">
          {grades.map((grade) => (
            <article className="activity-row" key={grade.id}>
              <span className="activity-mark">{grade.score}</span>
              <span>
                <strong>{grade.subject}</strong>
                <p className="field-help">
                  Matrícula {grade.enrollmentId} - {grade.createdAt ? formatDate(grade.createdAt) : 'Sin fecha'}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
