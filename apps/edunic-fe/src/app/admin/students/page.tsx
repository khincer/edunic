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
  type Student,
} from '@/lib/api';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadStudents();
  }, []);

  async function loadStudents(nextSearch = search) {


    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        search: nextSearch,
        limit: 50,
        sortBy: 'lastName',
        sortOrder: 'asc',
      });
      const result = await apiRequest<ApiListResponse<Student>>(`/students${query}`, {
      });
      setStudents(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de estudiantes');
    } finally {
      setLoading(false);
    }
  }

  async function createStudent() {

    if (!firstName.trim() || !lastName.trim()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<Student>>('/students', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          dateOfBirth: dateOfBirth || undefined,
        },
      });
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el estudiante');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Estudiantes</p>
          <h1 className="page-title">Directorio de estudiantes</h1>
          <p className="body-copy">Busque y agregue estudiantes.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Buscar</p>
              <h2 className="section-title">Buscar un estudiante</h2>
            </div>
          </div>
          <div className="form">
            <FormField
              label="Nombre"
              name="studentSearch"
              onChange={(event) => setSearch(event.target.value)}
              value={search}
            />
            <Button onClick={() => void loadStudents(search)}>Buscar</Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Crear</p>
              <h2 className="section-title">Nuevo estudiante</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Nombre" name="firstName" onChange={(event) => setFirstName(event.target.value)} value={firstName} />
            <FormField label="Apellido" name="lastName" onChange={(event) => setLastName(event.target.value)} value={lastName} />
            <FormField label="Fecha de nacimiento" name="dateOfBirth" onChange={(event) => setDateOfBirth(event.target.value)} type="date" value={dateOfBirth} />
            <Button disabled={saving || !firstName.trim() || !lastName.trim()} onClick={() => void createStudent()}>
              {saving ? 'Creando…' : 'Crear estudiante'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Registros</p>
            <h2 className="section-title">{students.length} estudiantes</h2>
          </div>
        </div>
        {loading ? <p className="body-copy">Cargando estudiantes…</p> : null}
        {!loading && students.length === 0 ? (
          <div className="empty-state body-copy">No se encontraron estudiantes.</div>
        ) : null}
        <div className="activity-list">
          {students.map((student) => (
            <article className="activity-row" key={student.id}>
              <span className="activity-mark">{student.firstName.slice(0, 1)}</span>
              <span>
                <strong>{student.fullName}</strong>
                <p className="field-help">
                  {student.dateOfBirth ?? 'Sin fecha de nacimiento'} - registrado el{' '}
                  {student.createdAt ? formatDate(student.createdAt) : 'no disponible'}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
