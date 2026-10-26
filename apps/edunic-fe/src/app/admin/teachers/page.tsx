'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DataTable } from '@/components/data-table';
import { FormField } from '@/components/form-field';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  formatClassroom,
  formatDate,
  type ApiListResponse,
  type ApiSingleResponse,
  type Classroom,
  type Teacher,
  type TeacherClassroom,
} from '@/lib/api';

type TeacherRow = Teacher & { classrooms: TeacherClassroom[] };

// TCH-01: the director manages the teacher roster and assigns each teacher
// one or more classrooms.
export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newClassroomIds, setNewClassroomIds] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      const [teacherResult, classroomResult] = await Promise.all([
        apiRequest<ApiListResponse<Teacher>>('/teachers?limit=100'),
        apiRequest<ApiListResponse<Classroom>>('/classrooms?limit=100'),
      ]);
      const rows = await Promise.all(
        teacherResult.data.map(async (teacher) => {
          const assigned = await apiRequest<ApiListResponse<TeacherClassroom>>(
            `/teachers/${teacher.id}/classrooms`
          );
          return { ...teacher, classrooms: assigned.data };
        })
      );
      setTeachers(rows);
      setClassrooms(classroomResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de docentes');
    } finally {
      setLoading(false);
    }
  }

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await action();
      setNotice(success);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setSaving(false);
    }
  }

  function createTeacher() {
    void run(
      async () => {
        await apiRequest<ApiSingleResponse<Teacher>>('/teachers', {
          method: 'POST',
          body: {
            email,
            password,
            role: 'teacher',
            classroomIds: newClassroomIds.length > 0 ? newClassroomIds : undefined,
          },
        });
        setEmail('');
        setPassword('');
        setNewClassroomIds([]);
      },
      'Cuenta de docente creada.',
      'No se pudo crear el docente'
    );
  }

  function assignClassroom(teacherId: string) {
    const classroomId = assignTo[teacherId];

    if (!classroomId) {
      return;
    }

    void run(
      async () => {
        await apiRequest(`/teachers/${teacherId}/classrooms`, {
          method: 'POST',
          body: { classroomIds: [classroomId] },
        });
        setAssignTo((current) => ({ ...current, [teacherId]: '' }));
      },
      'Aula asignada.',
      'No se pudo asignar el aula'
    );
  }

  function unassignClassroom(teacherId: string, classroomId: string) {
    void run(
      async () => {
        await apiRequest(`/teachers/${teacherId}/classrooms/${classroomId}`, {
          method: 'DELETE',
        });
      },
      'Aula quitada.',
      'No se pudo quitar el aula'
    );
  }

  function toggleNewClassroom(classroomId: string) {
    setNewClassroomIds((current) =>
      current.includes(classroomId)
        ? current.filter((id) => id !== classroomId)
        : [...current, classroomId]
    );
  }

  const canCreate = email.trim().length > 0 && password.length >= 8 && !saving;

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Docentes</p>
          <h1 className="page-title">Plantilla docente</h1>
          <p className="body-copy">
            Cree cuentas de docentes y asigne a cada docente las aulas que imparte.
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
              <h2 className="section-title">Nuevo docente</h2>
            </div>
          </div>
          <div className="form">
            <FormField
              autoComplete="off"
              label="Correo electrónico"
              name="teacherEmail"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
            <FormField
              autoComplete="new-password"
              help="Al menos 8 caracteres. Compártala con el docente de forma segura."
              label="Contraseña temporal"
              name="teacherPassword"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <fieldset className="form-field">
              <legend>Aulas</legend>
              {classrooms.length === 0 ? (
                <p className="field-help">Todavía no hay aulas.</p>
              ) : (
                classrooms.map((classroom) => (
                  <label className="checkbox-row" key={classroom.id}>
                    <input
                      checked={newClassroomIds.includes(classroom.id)}
                      onChange={() => toggleNewClassroom(classroom.id)}
                      type="checkbox"
                    />
                    {formatClassroom(classroom)}
                  </label>
                ))
              )}
            </fieldset>
            <Button disabled={!canCreate} onClick={createTeacher}>
              {saving ? 'Guardando…' : 'Crear docente'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Resumen</p>
              <h2 className="section-title">
                {teachers.length} {teachers.length === 1 ? 'docente' : 'docentes'}
              </h2>
            </div>
          </div>
          <p className="body-copy">
            {teachers.filter((teacher) => teacher.classrooms.length === 0).length} sin
            aula, {classrooms.length} aulas en el colegio.
          </p>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Listado</p>
            <h2 className="section-title">Docentes y sus aulas</h2>
          </div>
        </div>
        {loading ? (
          <PanelState message="Cargando docentes…" tone="loading" />
        ) : (
          <DataTable
            columns={[
              {
                key: 'email',
                header: 'Docente',
                render: (teacher) => <strong>{teacher.email}</strong>,
              },
              {
                key: 'classrooms',
                header: 'Aulas',
                render: (teacher) =>
                  teacher.classrooms.length === 0 ? (
                    <span className="field-help">Ninguna</span>
                  ) : (
                    <span className="button-row">
                      {teacher.classrooms.map((classroom) => (
                        <span className="badge badge-blue" key={classroom.id}>
                          {formatClassroom(classroom)}{' '}
                          <button
                            aria-label={`Quitar ${formatClassroom(classroom)} de ${teacher.email}`}
                            className="badge-remove"
                            disabled={saving}
                            onClick={() => unassignClassroom(teacher.id, classroom.id)}
                            type="button"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </span>
                  ),
              },
              {
                key: 'assign',
                header: 'Asignar',
                render: (teacher) => {
                  const available = classrooms.filter(
                    (classroom) =>
                      !teacher.classrooms.some((assigned) => assigned.id === classroom.id)
                  );

                  return (
                    <span className="button-row">
                      <select
                        aria-label={`Aula para ${teacher.email}`}
                        onChange={(event) =>
                          setAssignTo((current) => ({
                            ...current,
                            [teacher.id]: event.target.value,
                          }))
                        }
                        value={assignTo[teacher.id] ?? ''}
                      >
                        <option value="">Elija un aula</option>
                        {available.map((classroom) => (
                          <option key={classroom.id} value={classroom.id}>
                            {formatClassroom(classroom)}
                          </option>
                        ))}
                      </select>
                      <Button
                        disabled={saving || !assignTo[teacher.id]}
                        onClick={() => assignClassroom(teacher.id)}
                        variant="secondary"
                      >
                        Asignar
                      </Button>
                    </span>
                  );
                },
              },
              {
                key: 'createdAt',
                header: 'Desde',
                render: (teacher) =>
                  teacher.createdAt ? formatDate(teacher.createdAt) : 'no disponible',
              },
            ]}
            emptyMessage="Todavía no hay docentes. Cree la primera cuenta arriba."
            getRowKey={(teacher) => teacher.id}
            rows={teachers}
          />
        )}
      </section>
    </AdminShell>
  );
}
