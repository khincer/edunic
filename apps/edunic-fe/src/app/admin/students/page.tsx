'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  buildQuery,
  formatDay,
  formatGrado,
  type ApiListResponse,
  type ApiSingleResponse,
  type Classroom,
  type Student,
  type StudentRegistration,
  type StudentRegistrationInput,
} from '@/lib/api';

type GuardianDraft = {
  name: string;
  email: string;
  phone: string;
};

const EMPTY_GUARDIAN: GuardianDraft = { name: '', email: '', phone: '' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grados, setGrados] = useState<Classroom[]>([]);
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [firstLastName, setFirstLastName] = useState('');
  const [secondLastName, setSecondLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [guardian1, setGuardian1] = useState<GuardianDraft>(EMPTY_GUARDIAN);
  const [guardian2, setGuardian2] = useState<GuardianDraft>(EMPTY_GUARDIAN);
  const [withSecondGuardian, setWithSecondGuardian] = useState(false);
  const [registration, setRegistration] = useState<StudentRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGrados, setLoadingGrados] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const age = ageFrom(dateOfBirth);
  const guardians = withSecondGuardian ? [guardian1, guardian2] : [guardian1];
  const duplicateEmails =
    withSecondGuardian &&
    guardian1.email.trim() !== '' &&
    guardian1.email.trim().toLowerCase() === guardian2.email.trim().toLowerCase();
  const canSubmit =
    firstName.trim() !== '' &&
    firstLastName.trim() !== '' &&
    secondLastName.trim() !== '' &&
    dateOfBirth !== '' &&
    dateOfBirth <= today &&
    classroomId !== '' &&
    guardians.every(isGuardianComplete) &&
    !duplicateEmails;

  useEffect(() => {
    void loadStudents();
    void loadGrados();
  }, []);

  async function loadStudents(nextSearch = search) {
    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        search: nextSearch,
        limit: 50,
        sortBy: 'firstLastName',
        sortOrder: 'asc',
      });
      const result = await apiRequest<ApiListResponse<Student>>(`/students${query}`);
      setStudents(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de estudiantes');
    } finally {
      setLoading(false);
    }
  }

  async function loadGrados() {
    setLoadingGrados(true);

    try {
      const result = await apiRequest<ApiListResponse<Classroom>>('/classrooms?limit=100');
      setGrados(
        [...result.data].sort(
          (left, right) =>
            left.gradeLevel - right.gradeLevel ||
            (left.section ?? '').localeCompare(right.section ?? '')
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los grados');
    } finally {
      setLoadingGrados(false);
    }
  }

  async function registerStudent() {
    if (!canSubmit) {
      return;
    }

    setSaving(true);
    setError('');
    setRegistration(null);

    const body: StudentRegistrationInput = {
      firstName: firstName.trim(),
      secondName: secondName.trim() || undefined,
      firstLastName: firstLastName.trim(),
      secondLastName: secondLastName.trim(),
      dateOfBirth,
      classroomId,
      guardians: guardians.map((guardian) => ({
        name: guardian.name.trim(),
        email: guardian.email.trim(),
        phone: guardian.phone.trim() || undefined,
      })),
    };

    try {
      const result = await apiRequest<ApiSingleResponse<StudentRegistration>>(
        '/students/register',
        { method: 'POST', body }
      );
      setRegistration(result.data);
      resetForm();
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar al estudiante');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFirstName('');
    setSecondName('');
    setFirstLastName('');
    setSecondLastName('');
    setDateOfBirth('');
    setClassroomId('');
    setGuardian1(EMPTY_GUARDIAN);
    setGuardian2(EMPTY_GUARDIAN);
    setWithSecondGuardian(false);
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Estudiantes</p>
          <h1 className="page-title">Directorio de estudiantes</h1>
          <p className="body-copy">Registre estudiantes con sus tutores y búsquelos en el directorio.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {registration ? (
        <RegistrationSummary
          onClose={() => setRegistration(null)}
          registration={registration}
        />
      ) : null}

      <Card>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Registrar</p>
            <h2 className="section-title">Nuevo estudiante</h2>
          </div>
        </div>

        {!loadingGrados && grados.length === 0 ? (
          <div className="alert alert-info">
            No hay grados creados. Cree uno en <Link href="/admin/grados">Grados</Link>.
          </div>
        ) : null}

        <div className="form">
          <div className="grid grid-2">
            <FormField label="Nombre" name="firstName" onChange={(event) => setFirstName(event.target.value)} required value={firstName} />
            <FormField help="Opcional." label="Segundo nombre" name="secondName" onChange={(event) => setSecondName(event.target.value)} value={secondName} />
            <FormField label="Primer apellido" name="firstLastName" onChange={(event) => setFirstLastName(event.target.value)} required value={firstLastName} />
            <FormField label="Segundo apellido" name="secondLastName" onChange={(event) => setSecondLastName(event.target.value)} required value={secondLastName} />
            <FormField
              help={age === null ? undefined : `Edad: ${age} ${age === 1 ? 'año' : 'años'}`}
              label="Fecha de nacimiento"
              max={today}
              name="dateOfBirth"
              onChange={(event) => setDateOfBirth(event.target.value)}
              required
              type="date"
              value={dateOfBirth}
            />
            <div className="form-field">
              <label htmlFor="classroomId">Grado</label>
              <select
                disabled={grados.length === 0}
                id="classroomId"
                onChange={(event) => setClassroomId(event.target.value)}
                required
                value={classroomId}
              >
                <option value="">{loadingGrados ? 'Cargando grados…' : 'Seleccione un grado'}</option>
                {grados.map((grado) => (
                  <option key={grado.id} value={grado.id}>
                    {formatGrado(grado)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="field-help">
            Cada tutor necesita un correo. Si el correo no tiene cuenta, se crea una cuenta del
            portal de familias con una contraseña temporal que se muestra una sola vez al
            terminar el registro.
          </p>

          <GuardianFields
            guardian={guardian1}
            idPrefix="guardian1"
            onChange={setGuardian1}
            title="Tutor 1"
          />

          {withSecondGuardian ? (
            <>
              <GuardianFields
                guardian={guardian2}
                idPrefix="guardian2"
                onChange={setGuardian2}
                title="Tutor 2"
              />
              {duplicateEmails ? (
                <p className="field-help">Los dos tutores deben tener correos distintos.</p>
              ) : null}
              <div className="button-row">
                <Button
                  onClick={() => {
                    setWithSecondGuardian(false);
                    setGuardian2(EMPTY_GUARDIAN);
                  }}
                  variant="ghost"
                >
                  Quitar tutor 2
                </Button>
              </div>
            </>
          ) : (
            <div className="button-row">
              <Button onClick={() => setWithSecondGuardian(true)} variant="secondary">
                Agregar tutor 2
              </Button>
            </div>
          )}

          <Button disabled={saving || !canSubmit} onClick={() => void registerStudent()}>
            {saving ? 'Registrando…' : 'Registrar estudiante'}
          </Button>
        </div>
      </Card>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Registros</p>
            <h2 className="section-title">{students.length} estudiantes</h2>
          </div>
        </div>
        <div className="form">
          <FormField
            label="Buscar por nombre o apellido"
            name="studentSearch"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
          <div className="button-row">
            <Button onClick={() => void loadStudents(search)} variant="secondary">
              Buscar
            </Button>
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
                  {student.gradeLevel != null
                    ? formatGrado({ gradeLevel: student.gradeLevel, section: student.section ?? null })
                    : 'Sin grado en el período activo'}
                  {' · '}
                  {student.guardians && student.guardians.length > 0
                    ? `Tutores: ${student.guardians.map((guardian) => guardian.name).join(', ')}`
                    : 'Sin tutores'}
                  {' · '}
                  {student.dateOfBirth
                    ? `${formatDay(student.dateOfBirth)}${student.age != null ? ` (${student.age} ${student.age === 1 ? 'año' : 'años'})` : ''}`
                    : 'Sin fecha de nacimiento'}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}

function GuardianFields({
  title,
  idPrefix,
  guardian,
  onChange,
}: {
  title: string;
  idPrefix: string;
  guardian: GuardianDraft;
  onChange: (guardian: GuardianDraft) => void;
}) {
  const emailInvalid = guardian.email.trim() !== '' && !EMAIL_PATTERN.test(guardian.email.trim());

  return (
    <fieldset className="form">
      <legend className="section-title">{title}</legend>
      <div className="grid grid-2">
        <FormField
          label="Nombre"
          name={`${idPrefix}Name`}
          onChange={(event) => onChange({ ...guardian, name: event.target.value })}
          required
          value={guardian.name}
        />
        <FormField
          help={emailInvalid ? 'Ingrese un correo válido.' : undefined}
          label="Correo"
          name={`${idPrefix}Email`}
          onChange={(event) => onChange({ ...guardian, email: event.target.value })}
          required
          type="email"
          value={guardian.email}
        />
        <FormField
          help="Opcional."
          label="Teléfono"
          name={`${idPrefix}Phone`}
          onChange={(event) => onChange({ ...guardian, phone: event.target.value })}
          type="tel"
          value={guardian.phone}
        />
      </div>
    </fieldset>
  );
}

function RegistrationSummary({
  registration,
  onClose,
}: {
  registration: StudentRegistration;
  onClose: () => void;
}) {
  const [copiedUserId, setCopiedUserId] = useState('');
  const { student, enrollment, academicPeriod } = registration;

  async function copyPassword(userId: string, password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedUserId(userId);
    } catch {
      setCopiedUserId('');
    }
  }

  return (
    <section className="card section-stack" role="status">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Registro completado</p>
          <h2 className="section-title">{student.fullName}</h2>
        </div>
        <Button onClick={onClose} variant="secondary">
          Cerrar
        </Button>
      </div>
      <p className="body-copy">
        {formatGrado(enrollment.classroom)} · Período {academicPeriod.term} de {academicPeriod.year} ·{' '}
        {student.age} {student.age === 1 ? 'año' : 'años'}
      </p>
      <div className="activity-list">
        {registration.guardians.map((guardian) => (
          <article className="activity-row" key={guardian.id}>
            <span className="activity-mark">{guardian.name.slice(0, 1)}</span>
            <span>
              <strong>{guardian.name}</strong>
              <p className="field-help">{guardian.email}</p>
              {guardian.account.temporaryPassword ? (
                <div className="alert alert-info">
                  <p className="body-copy">
                    Se creó una cuenta del portal de familias. Contraseña temporal:{' '}
                    <code>{guardian.account.temporaryPassword}</code>
                  </p>
                  <p className="field-help">
                    Cópiela y entréguela al tutor: no se volverá a mostrar.
                  </p>
                  <div className="button-row">
                    <Button
                      className="button-small"
                      onClick={() =>
                        void copyPassword(
                          guardian.account.userId,
                          guardian.account.temporaryPassword ?? ''
                        )
                      }
                      variant="secondary"
                    >
                      {copiedUserId === guardian.account.userId ? 'Copiada' : 'Copiar contraseña'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="field-help">Se vinculó a su cuenta existente del portal de familias.</p>
              )}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

function isGuardianComplete(guardian: GuardianDraft) {
  return guardian.name.trim() !== '' && EMAIL_PATTERN.test(guardian.email.trim());
}

// Whole years from a YYYY-MM-DD date to today, or null for an empty or
// future date.
function ageFrom(dateOfBirth: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);

  if (!match) {
    return null;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const now = new Date();
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  const age = now.getFullYear() - year - (hadBirthday ? 0 : 1);

  return age >= 0 ? age : null;
}
