'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import {
  ApiError,
  apiRequest,
  formatGrado,
  type ApiListResponse,
  type ApiSingleResponse,
  type Classroom,
} from '@/lib/api';

const MIN_GRADE_LEVEL = 1;
const MAX_GRADE_LEVEL = 12;

export default function AdminGradosPage() {
  const [grados, setGrados] = useState<Classroom[]>([]);
  const [gradeLevel, setGradeLevel] = useState('1');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Classroom | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const gradeLevelNumber = Number(gradeLevel);
  const gradeLevelValid =
    Number.isInteger(gradeLevelNumber) &&
    gradeLevelNumber >= MIN_GRADE_LEVEL &&
    gradeLevelNumber <= MAX_GRADE_LEVEL;

  useEffect(() => {
    void loadGrados();
  }, []);

  async function loadGrados() {
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiListResponse<Classroom>>('/classrooms?limit=100');
      setGrados(sortGrados(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los grados');
    } finally {
      setLoading(false);
    }
  }

  async function createGrado() {
    if (!gradeLevelValid) {
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const result = await apiRequest<ApiSingleResponse<Classroom>>('/classrooms', {
        method: 'POST',
        body: {
          gradeLevel: gradeLevelNumber,
          section: section.trim() || undefined,
        },
      });
      setSection('');
      setNotice(`${formatGrado(result.data)} creado.`);
      await loadGrados();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Ya existe un grado con ese nivel y sección.');
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo crear el grado');
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteGrado(grado: Classroom) {
    setDeleting(true);
    setError('');
    setNotice('');

    try {
      await apiRequest(`/classrooms/${grado.id}`, { method: 'DELETE' });
      setNotice(`${formatGrado(grado)} eliminado.`);
      await loadGrados();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(
          `No se puede eliminar ${formatGrado(grado)}: tiene estudiantes matriculados.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo eliminar el grado');
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Grados</p>
          <h1 className="page-title">Grados del colegio</h1>
          <p className="body-copy">
            Cree los grados y secciones en los que se matricula a los estudiantes.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Crear</p>
              <h2 className="section-title">Nuevo grado</h2>
            </div>
          </div>
          <div className="form">
            <FormField
              help={`Un número del ${MIN_GRADE_LEVEL} al ${MAX_GRADE_LEVEL}.`}
              label="Grado"
              max={MAX_GRADE_LEVEL}
              min={MIN_GRADE_LEVEL}
              name="gradeLevel"
              onChange={(event) => setGradeLevel(event.target.value)}
              required
              type="number"
              value={gradeLevel}
            />
            <FormField
              help="Opcional. Por ejemplo: A."
              label="Sección"
              maxLength={20}
              name="section"
              onChange={(event) => setSection(event.target.value)}
              value={section}
            />
            <Button disabled={saving || !gradeLevelValid} onClick={() => void createGrado()}>
              {saving ? 'Creando…' : 'Crear grado'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 className="section-title">{grados.length} grados</h2>
            </div>
            <Button onClick={() => void loadGrados()} variant="secondary">
              Actualizar
            </Button>
          </div>
          {loading ? <p className="body-copy">Cargando grados…</p> : null}
          {!loading && grados.length === 0 ? (
            <div className="empty-state body-copy">Todavía no hay grados creados.</div>
          ) : null}
          <div className="activity-list">
            {grados.map((grado) => (
              <article className="activity-row activity-row-action" key={grado.id}>
                <span className="activity-mark">{grado.gradeLevel}</span>
                <span>
                  <strong>{formatGrado(grado)}</strong>
                </span>
                <Button
                  className="button-small"
                  disabled={deleting}
                  onClick={() => setPendingDelete(grado)}
                  variant="ghost"
                >
                  Eliminar
                </Button>
              </article>
            ))}
          </div>
        </Card>
      </section>

      <ConfirmDialog
        body="Solo se puede eliminar un grado sin estudiantes matriculados."
        busy={deleting}
        confirmLabel="Eliminar grado"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void deleteGrado(pendingDelete)}
        open={pendingDelete !== null}
        title={pendingDelete ? `¿Eliminar ${formatGrado(pendingDelete)}?` : ''}
      />
    </AdminShell>
  );
}

function sortGrados(grados: Classroom[]) {
  return [...grados].sort(
    (left, right) =>
      left.gradeLevel - right.gradeLevel ||
      (left.section ?? '').localeCompare(right.section ?? '')
  );
}
