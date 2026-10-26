'use client';

import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Mail,
  Workflow,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ActivityMark, getAssignmentActivityKind } from '@/components/activity-mark';
import { formatRole, isAdminRole } from '@/lib/roles';
import { Button } from '@/components/button';
import { FormField, TextAreaField } from '@/components/form-field';
import { PanelState } from '@/components/panel-state';
import {
  apiRequest,
  buildQuery,
  type ApiListResponse,
  type ApiSingleResponse,
  type AttendanceRecord,
  type AttendanceStatus,
  type Classroom,
  type Enrollment,
  type Grade,
  type TeacherDashboard,
} from '@/lib/api';
import { clearSession, getSession, type AdminSession } from '@/lib/auth';

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLocalDateTime(offsetDays = 1) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  value.setHours(9, 0, 0, 0);
  return value.toISOString().slice(0, 16);
}

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: 'Presente',
  late: 'Tardanza',
  absent: 'Ausente',
};

export default function TeachersPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [gradeSubject, setGradeSubject] = useState('Matemáticas');
  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [error, setError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [notice, setNotice] = useState('');
  const [workflowTitle, setWorkflowTitle] = useState('');
  const [workflowType, setWorkflowType] = useState<'homework' | 'exam' | 'assignment'>('homework');
  const [workflowDueDate, setWorkflowDueDate] = useState(getLocalDateTime(2));
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState(getLocalDateTime(3));
  const [recipientUserId, setRecipientUserId] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [savingWorkflow, setSavingWorkflow] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'roster' | 'messages' | 'events' | 'publish'>('overview');

  const canUseTeacherTools =
    session?.user.role === 'teacher' ||
    (session !== null && isAdminRole(session.user.role));
  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === selectedClassroomId),
    [classrooms, selectedClassroomId]
  );
  const attendanceSummary = useMemo(() => {
    return enrollments.reduce(
      (summary, enrollment) => {
        const status = attendanceStatus[enrollment.id] ?? 'present';
        summary[status] += 1;
        return summary;
      },
      { present: 0, absent: 0, late: 0 } satisfies Record<AttendanceStatus, number>
    );
  }, [attendanceStatus, enrollments]);

  useEffect(() => {
    const storedSession = getSession();
    setSession(storedSession);
    setReady(true);

    if (!storedSession) {
      router.replace('/teachers/login');
    }
  }, [router]);

  useEffect(() => {
    if (!session || !canUseTeacherTools) {
      return;
    }

    void loadClassrooms();
    void loadDashboard();
  }, [canUseTeacherTools, session]);

  useEffect(() => {
    if (!session || !selectedClassroomId) {
      setEnrollments([]);
      return;
    }

    void loadRoster(selectedClassroomId);
  }, [selectedClassroomId, session]);

  useEffect(() => {
    if (!session || enrollments.length === 0) {
      setAttendanceStatus({});
      setAttendanceRecords({});
      return;
    }

    void loadAttendanceForDate(enrollments, attendanceDate);
  }, [attendanceDate, enrollments, session]);

  function handleSignOut() {
    clearSession();
    setSession(null);
    setClassrooms([]);
    setDashboard(null);
    setSelectedClassroomId('');
    setEnrollments([]);
    setNotice('');
    router.replace('/teachers/login');
  }

  async function loadClassrooms() {
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiListResponse<Classroom>>(
        '/classrooms?limit=100&sortBy=gradeLevel&sortOrder=asc',
        {}
      );
      setClassrooms(result.data);
      setSelectedClassroomId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las aulas');
    } finally {
      setLoading(false);
    }
  }

  async function loadRoster(classroomId: string) {
    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        classroomId,
        status: 'active',
        sortBy: 'studentName',
        sortOrder: 'asc',
        limit: 100,
      });
      const result = await apiRequest<ApiListResponse<Enrollment>>(
        `/enrollments${query}`,
        {}
      );
      setEnrollments(result.data);
      setGradeScores({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista de estudiantes');
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceForDate(
    roster: Enrollment[],
    date: string
  ) {
    setError('');

    try {
      const pairs = await Promise.all(
        roster.map(async (enrollment) => {
          const query = buildQuery({
            enrollmentId: enrollment.id,
            date,
            limit: 1,
          });
          const result = await apiRequest<ApiListResponse<AttendanceRecord>>(
            `/attendance${query}`,
            {}
          );
          return [enrollment.id, result.data[0] ?? null] as const;
        })
      );
      const nextRecords: Record<string, AttendanceRecord> = {};
      const nextStatuses: Record<string, AttendanceStatus> = {};

      for (const [enrollmentId, record] of pairs) {
        if (record) {
          nextRecords[enrollmentId] = record;
          nextStatuses[enrollmentId] = record.status;
        } else {
          nextStatuses[enrollmentId] = 'present';
        }
      }

      setAttendanceRecords(nextRecords);
      setAttendanceStatus(nextStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la asistencia');
    }
  }

  async function saveAttendance() {
    if (!session) {
      return;
    }

    setSavingAttendance(true);
    setError('');
    setNotice('');

    try {
      await Promise.all(
        enrollments.map((enrollment) => {
          const existingRecord = attendanceRecords[enrollment.id];
          const status = attendanceStatus[enrollment.id] ?? 'present';

          if (existingRecord) {
            return apiRequest<ApiSingleResponse<AttendanceRecord>>(
              `/attendance/${existingRecord.id}`,
              {
                method: 'PATCH',
                body: { status },
              }
            );
          }

          return apiRequest<ApiSingleResponse<AttendanceRecord>>('/attendance', {
            method: 'POST',
            body: {
              enrollmentId: enrollment.id,
              date: attendanceDate,
              status,
            },
          });
        })
      );
      await loadAttendanceForDate(enrollments, attendanceDate);
      setNotice('Asistencia guardada para la fecha seleccionada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la asistencia');
    } finally {
      setSavingAttendance(false);
    }
  }

  async function submitGrades() {
    if (!session) {
      return;
    }

    const scores = enrollments
      .map((enrollment) => ({
        enrollment,
        score: gradeScores[enrollment.id]?.trim(),
      }))
      .filter((item) => item.score !== undefined && item.score !== '');

    if (scores.length === 0) {
      setError('Ingrese al menos una calificación antes de enviar.');
      return;
    }

    setSavingGrades(true);
    setError('');
    setNotice('');

    try {
      await Promise.all(
        scores.map(({ enrollment, score }) =>
          apiRequest<ApiSingleResponse<Grade>>('/grades', {
            method: 'POST',
            body: {
              enrollmentId: enrollment.id,
              subject: gradeSubject,
              score: Number(score),
            },
          })
        )
      );
      setGradeScores({});
      setNotice(`Calificaciones enviadas: ${scores.length}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron enviar las calificaciones');
    } finally {
      setSavingGrades(false);
    }
  }

  if (!ready || !session) {
    return (
      <main className="teacher-app">
        <div className="teacher-content">
          <section className="empty-state body-copy">Abriendo el espacio de trabajo del docente…</section>
        </div>
      </main>
    );
  }

  async function createAssignment() {
    if (!session || !selectedClassroomId || !workflowTitle.trim()) {
      return;
    }

    setSavingWorkflow('assignment');
    setError('');
    setNotice('');

    try {
      await apiRequest('/assignments', {
        method: 'POST',
        body: {
          classroomId: selectedClassroomId,
          title: workflowTitle,
          type: workflowType,
          status: 'published',
          dueDate: workflowDueDate ? new Date(workflowDueDate).toISOString() : undefined,
        },
      });
      setNotice('Trabajo del aula publicado.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar el trabajo del aula');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function createClassroomEvent() {
    if (!session || !selectedClassroomId || !eventTitle.trim() || !eventStartsAt) {
      return;
    }

    setSavingWorkflow('event');
    setError('');
    setNotice('');

    try {
      await apiRequest('/school-events', {
        method: 'POST',
        body: {
          classroomId: selectedClassroomId,
          title: eventTitle,
          eventType: 'classroom',
          startsAt: new Date(eventStartsAt).toISOString(),
        },
      });
      setNotice('Evento del aula programado.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo programar el evento');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function sendMessage() {
    if (!session || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()) {
      return;
    }

    setSavingWorkflow('message');
    setError('');
    setNotice('');

    try {
      await apiRequest('/messages', {
        method: 'POST',
        body: {
          recipientUserId,
          subject: messageSubject,
          body: messageBody,
        },
      });
      setMessageBody('');
      setNotice('Mensaje enviado.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!session) {
      return;
    }

    setSavingWorkflow(notificationId);
    setError('');

    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar la notificación como leída');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function markMessageRead(messageId: string) {
    if (!session) {
      return;
    }

    setSavingWorkflow(messageId);
    setError('');

    try {
      await apiRequest(`/messages/${messageId}/read`, {
        method: 'PATCH',
      });
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar el mensaje como leído');
    } finally {
      setSavingWorkflow('');
    }
  }

  async function loadDashboard() {
    setDashboardError('');
    setError('');

    try {
      const result = await apiRequest<ApiSingleResponse<TeacherDashboard>>(
        '/dashboard/teacher',
        {}
      );
      setDashboard(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar el panel del docente';
      setDashboard(null);
      setDashboardError(message);
      setError(message);
    }
  }

  const sectionLabel: Record<string, string> = {
    overview: 'Resumen',
    roster: 'Lista de estudiantes',
    messages: 'Mensajes',
    events: 'Eventos',
    publish: 'Publicar trabajo',
  };

  return (
    <main className="teacher-app">
      <div className="teacher-shell">
        <aside className="teacher-sidebar">
          <div className="teacher-brand">
            <span className="teacher-brand-mark">E</span>
            <span>
              <strong className="teacher-brand-title">Edunic</strong>
              <span className="teacher-brand-subtitle">Docentes</span>
            </span>
          </div>
          <nav aria-label="Navegación del docente" className="teacher-nav">
            <div className="teacher-nav-group">
              <p>Espacio de trabajo</p>
              <button
                className="teacher-nav-link"
                data-active={activeSection === 'overview'}
                onClick={() => setActiveSection('overview')}
                type="button"
              >
                <span className="teacher-nav-icon" aria-hidden="true">
                  <LayoutDashboard size={16} strokeWidth={2} />
                </span>
                Resumen
              </button>
              <button
                className="teacher-nav-link"
                data-active={activeSection === 'roster'}
                onClick={() => setActiveSection('roster')}
                type="button"
              >
                <span className="teacher-nav-icon" aria-hidden="true">
                  <ClipboardCheck size={16} strokeWidth={2} />
                </span>
                Lista de estudiantes
              </button>
              <button
                className="teacher-nav-link"
                data-active={activeSection === 'messages'}
                onClick={() => setActiveSection('messages')}
                type="button"
              >
                <span className="teacher-nav-icon" aria-hidden="true">
                  <Mail size={16} strokeWidth={2} />
                </span>
                Mensajes
              </button>
            </div>
            <div className="teacher-nav-group">
              <p>Publicar</p>
              <button
                className="teacher-nav-link"
                data-active={activeSection === 'events'}
                onClick={() => setActiveSection('events')}
                type="button"
              >
                <span className="teacher-nav-icon" aria-hidden="true">
                  <CalendarDays size={16} strokeWidth={2} />
                </span>
                Eventos
              </button>
              <button
                className="teacher-nav-link"
                data-active={activeSection === 'publish'}
                onClick={() => setActiveSection('publish')}
                type="button"
              >
                <span className="teacher-nav-icon" aria-hidden="true">
                  <Workflow size={16} strokeWidth={2} />
                </span>
                Publicar trabajo
              </button>
            </div>
          </nav>
          <div className="teacher-sidebar-footer">
            <span className="teacher-sidebar-user">
              <strong>{session.user.email}</strong>
              <span>{formatRole(session.user.role)}</span>
            </span>
            <Button
              aria-label="Cerrar sesión"
              className="button-small"
              onClick={handleSignOut}
              title="Cerrar sesión"
              variant="ghost"
            >
              <LogOut aria-hidden="true" size={16} strokeWidth={2} />
            </Button>
          </div>
        </aside>

        <section className="teacher-main">
          <div className="teacher-content">
            <header className="page-header">
              <h1 className="page-title">{sectionLabel[activeSection]}</h1>
            </header>
            {!canUseTeacherTools ? (
              <div className="alert alert-error">
                Esta cuenta no puede usar las herramientas del docente. Inicie sesión como docente o administrador.
              </div>
            ) : null}
            {error ? <div className="alert alert-error">{error}</div> : null}
            {notice ? <div className="alert alert-info">{notice}</div> : null}

            {activeSection === 'overview' ? (
              <section className="teacher-section">
                <nav className="teacher-kpis" aria-label="Resumen del panel del docente">
                  <button
                    className="teacher-kpi"
                    onClick={() => setActiveSection('roster')}
                    type="button"
                  >
                    <strong>{dashboard ? dashboard.pendingAttendance : '\u2014'}</strong>
                    <span>Asistencia pendiente</span>
                  </button>
                  <button
                    className={
                      dashboard && dashboard.studentsAtRisk.length > 0
                        ? 'teacher-kpi teacher-kpi-danger'
                        : 'teacher-kpi'
                    }
                    onClick={() => setActiveSection('overview')}
                    type="button"
                  >
                    <strong>{dashboard ? dashboard.studentsAtRisk.length : '\u2014'}</strong>
                    <span>Estudiantes en riesgo</span>
                  </button>
                  <button
                    className="teacher-kpi"
                    onClick={() => setActiveSection('messages')}
                    type="button"
                  >
                    <strong>{dashboard ? dashboard.unreadMessages : '\u2014'}</strong>
                    <span>Mensajes sin leer</span>
                  </button>
                  <button
                    className="teacher-kpi"
                    onClick={() => setActiveSection('events')}
                    type="button"
                  >
                    <strong>
                      {dashboard
                        ? dashboard.upcomingAssignments.length + dashboard.upcomingEvents.length
                        : '\u2014'}
                    </strong>
                    <span>Próximos elementos</span>
                  </button>
                </nav>

                <div className="teacher-summary" style={{ width: '100%' }}>
                  <div>
                    <span>Presente</span>
                    <strong>{dashboard?.attendanceToday.present ?? attendanceSummary.present}</strong>
                  </div>
                  <div>
                    <span>Tardanza</span>
                    <strong>{dashboard?.attendanceToday.late ?? attendanceSummary.late}</strong>
                  </div>
                  <div>
                    <span>Ausente</span>
                    <strong>{dashboard?.attendanceToday.absent ?? attendanceSummary.absent}</strong>
                  </div>
                </div>

                <div className="teacher-section-heading">
                  <p className="eyebrow">Hoy</p>
                  <h2 className="section-title">Vista general</h2>
                </div>
                <div className="teacher-home-grid">
                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Hoy</p>
                        <h2 className="section-title">Estado de las aulas</h2>
                      </div>
                      <span className="badge badge-blue">
                        {dashboard?.pendingAttendance ?? 0} pendientes
                      </span>
                    </div>
                    <div className="classroom-snapshot-list">
                      {(dashboard?.classrooms ?? []).map((classroom) => (
                        <div className="classroom-snapshot-row" key={classroom.id}>
                          <span>
                            <strong>{classroom.name}</strong>
                            <p className="field-help">{classroom.rosterCount} estudiantes activos</p>
                          </span>
                          <span className="badge">
                            {classroom.attendanceMarkedToday}/{classroom.rosterCount} registrados
                          </span>
                        </div>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar los datos del panel.' : 'Cargando estado de las aulas…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.classrooms.length === 0 ? (
                        <PanelState message="Todavía no hay aulas asignadas disponibles." />
                      ) : null}
                    </div>
                  </article>

                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Riesgo académico</p>
                        <h2 className="section-title">Requiere atención</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.studentsAtRisk ?? []).map((student) => (
                        <article className="activity-row" key={student.studentId}>
                          <ActivityMark kind="risk" tone="danger" />
                          <span>
                            <strong>{student.studentName}</strong>
                            <p className="field-help">
                              {student.classroomName ?? 'Sin aula'} - promedio{' '}
                              {student.average ?? 'n/d'} - {student.absences} ausencias
                            </p>
                          </span>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar los datos de riesgo académico.' : 'Cargando estudiantes en riesgo…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.studentsAtRisk.length === 0 ? (
                        <PanelState message="No hay alertas de riesgo para la lista actual." />
                      ) : null}
                    </div>
                  </article>
                </div>

                <div className="teacher-home-grid">
                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Próximas tareas</p>
                        <h2 className="section-title">Tareas y exámenes</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.upcomingAssignments ?? []).map((assignment) => (
                        <article className="activity-row" key={assignment.id}>
                          <ActivityMark kind={getAssignmentActivityKind(assignment.type)} />
                          <span>
                            <strong>{assignment.title}</strong>
                            <p className="field-help">
                              {assignment.classroomName ?? 'Aula'} -{' '}
                              {assignment.dueDate ? assignment.dueDate.slice(0, 10) : 'Sin fecha de entrega'}
                            </p>
                          </span>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar las tareas.' : 'Cargando tareas…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.upcomingAssignments.length === 0 ? (
                        <PanelState message="No hay tareas ni exámenes próximos." />
                      ) : null}
                    </div>
                  </article>

                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Calendario</p>
                        <h2 className="section-title">Próximos eventos</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.upcomingEvents ?? []).map((event) => (
                        <article className="activity-row" key={event.id}>
                          <ActivityMark kind="calendar" />
                          <span>
                            <strong>{event.title}</strong>
                            <p className="field-help">
                              {event.classroomName ?? 'Todo el colegio'} - {event.startsAt.slice(0, 10)}
                            </p>
                          </span>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar los próximos eventos.' : 'Cargando próximos eventos…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.upcomingEvents.length === 0 ? (
                        <PanelState message="No hay eventos próximos." />
                      ) : null}
                    </div>
                  </article>
                </div>
              </section>
            ) : null}

            {activeSection === 'roster' ? (
              <section className="teacher-section">
                <div className="teacher-section-heading">
                  <p className="eyebrow">Espacio de trabajo</p>
                  <h2 className="section-title">Lista diaria</h2>
                </div>
                <div className="teacher-layout">
                  <aside className="card teacher-controls">
                    <div className="form-field">
                      <label htmlFor="classroom">Aula</label>
                      <select
                        disabled={loading || classrooms.length === 0}
                        id="classroom"
                        onChange={(event) => setSelectedClassroomId(event.target.value)}
                        value={selectedClassroomId}
                      >
                        {classrooms.map((classroom) => (
                          <option key={classroom.id} value={classroom.id}>
                            {classroom.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <FormField
                      label="Fecha de asistencia"
                      name="attendanceDate"
                      onChange={(event) => setAttendanceDate(event.target.value)}
                      type="date"
                      value={attendanceDate}
                    />
                    <FormField
                      label="Materia de la calificación"
                      name="gradeSubject"
                      onChange={(event) => setGradeSubject(event.target.value)}
                      required
                      type="text"
                      value={gradeSubject}
                    />
                    <div className="classroom-context">
                      <span className="badge badge-blue">{selectedClassroom?.name ?? 'Sin aula'}</span>
                      <p className="body-copy">
                        {loading
                          ? 'Cargando datos del aula…'
                          : `${enrollments.length} matrícula${enrollments.length === 1 ? '' : 's'} activa${enrollments.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </aside>

                  <section className="card teacher-roster">
                    <div className="page-header">
                      <div>
                        <p className="eyebrow">Lista diaria</p>
                        <h2 className="section-title">Registrar asistencia e ingresar calificaciones</h2>
                      </div>
                      <div className="button-row">
                        <Button
                          disabled={savingAttendance || enrollments.length === 0}
                          onClick={saveAttendance}
                        >
                          {savingAttendance ? 'Guardando…' : 'Guardar asistencia'}
                        </Button>
                        <Button
                          disabled={savingGrades || enrollments.length === 0 || !gradeSubject.trim()}
                          onClick={submitGrades}
                          variant="secondary"
                        >
                          {savingGrades ? 'Enviando…' : 'Enviar calificaciones'}
                        </Button>
                      </div>
                    </div>

                    {enrollments.length === 0 && !loading ? (
                      <PanelState message="No se encontraron matrículas activas en este aula." />
                    ) : null}

                    <div className="teacher-student-list">
                      {enrollments.map((enrollment) => (
                        <article className="teacher-student-row" key={enrollment.id}>
                          <div>
                            <strong>{enrollment.student.fullName}</strong>
                            <p className="field-help">Matrícula {enrollment.id}</p>
                          </div>
                          <div className="attendance-toggle" aria-label={`${enrollment.student.fullName}: asistencia`}>
                            {(['present', 'late', 'absent'] as AttendanceStatus[]).map((status) => (
                              <button
                                data-active={(attendanceStatus[enrollment.id] ?? 'present') === status}
                                key={status}
                                onClick={() =>
                                  setAttendanceStatus((current) => ({
                                    ...current,
                                    [enrollment.id]: status,
                                  }))
                                }
                                type="button"
                              >
                                {attendanceStatusLabels[status]}
                              </button>
                            ))}
                          </div>
                          <label className="score-cell">
                            <span>Calificación</span>
                            <input
                              max={100}
                              min={0}
                              onChange={(event) =>
                                setGradeScores((current) => ({
                                  ...current,
                                  [enrollment.id]: event.target.value,
                                }))
                              }
                              placeholder="0-100"
                              type="number"
                              value={gradeScores[enrollment.id] ?? ''}
                            />
                          </label>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            ) : null}

            {activeSection === 'messages' ? (
              <section className="teacher-section">
                <div className="teacher-section-heading">
                  <p className="eyebrow">Mensajes</p>
                  <h2 className="section-title">Bandeja de entrada</h2>
                </div>

                <div className="teacher-home-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Calificaciones recientes</p>
                        <h2 className="section-title">Últimos envíos</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.recentGrades ?? []).map((grade) => (
                        <article className="activity-row" key={grade.id}>
                          <span className="activity-mark activity-mark-value">{grade.score}</span>
                          <span>
                            <strong>{grade.studentName}</strong>
                            <p className="field-help">{grade.subject}</p>
                          </span>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar las calificaciones recientes.' : 'Cargando calificaciones recientes…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.recentGrades.length === 0 ? (
                        <PanelState message="Todavía no hay calificaciones enviadas." />
                      ) : null}
                    </div>
                  </article>

                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Notificaciones</p>
                        <h2 className="section-title">Notificaciones</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.recentNotifications ?? []).map((notification) => (
                        <article className="activity-row activity-row-action" data-unread={!notification.readAt} key={notification.id}>
                          <ActivityMark kind="notification" />
                          <span>
                            <strong>{notification.title}</strong>
                            <p className="field-help">
                              {notification.message} - {notification.readAt ? 'leída' : 'sin leer'}
                            </p>
                          </span>
                          <Button
                            disabled={Boolean(notification.readAt) || savingWorkflow === notification.id}
                            onClick={() => void markNotificationRead(notification.id)}
                            variant="secondary"
                          >
                            {notification.readAt ? 'Leída' : 'Marcar como leída'}
                          </Button>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar las notificaciones.' : 'Cargando notificaciones…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.recentNotifications.length === 0 ? (
                        <PanelState message="No hay notificaciones." />
                      ) : null}
                    </div>
                  </article>
                </div>

                <div className="teacher-home-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <article className="card teacher-home-panel teacher-home-panel-wide">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Bandeja de entrada</p>
                        <h2 className="section-title">{dashboard?.unreadMessages ?? 0} mensajes sin leer</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.recentMessages ?? []).map((message) => (
                        <article className="activity-row activity-row-action" data-unread={!message.readAt} key={message.id}>
                          <ActivityMark kind="message" />
                          <span>
                            <strong>{message.subject}</strong>
                            <p className="field-help">{message.body}</p>
                          </span>
                          <Button
                            disabled={Boolean(message.readAt) || savingWorkflow === message.id}
                            onClick={() => void markMessageRead(message.id)}
                            variant="secondary"
                          >
                            {message.readAt ? 'Leído' : 'Marcar como leído'}
                          </Button>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudo cargar la bandeja de entrada.' : 'Cargando bandeja de entrada…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.recentMessages.length === 0 ? (
                        <PanelState message="Todavía no hay mensajes." />
                      ) : null}
                    </div>
                  </article>
                </div>
              </section>
            ) : null}

            {activeSection === 'events' ? (
              <section className="teacher-section">
                <div className="teacher-section-heading">
                  <p className="eyebrow">Calendario</p>
                  <h2 className="section-title">Próximos eventos</h2>
                </div>
                <div className="teacher-home-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <article className="card teacher-home-panel">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Calendario</p>
                        <h2 className="section-title">Próximos eventos</h2>
                      </div>
                    </div>
                    <div className="activity-list">
                      {(dashboard?.upcomingEvents ?? []).map((event) => (
                        <article className="activity-row" key={event.id}>
                          <ActivityMark kind="calendar" />
                          <span>
                            <strong>{event.title}</strong>
                            <p className="field-help">
                              {event.classroomName ?? 'Todo el colegio'} - {event.startsAt.slice(0, 10)}
                            </p>
                          </span>
                        </article>
                      ))}
                      {dashboard ? null : (
                        <PanelState
                          message={dashboardError ? 'No se pudieron cargar los próximos eventos.' : 'Cargando próximos eventos…'}
                          tone={dashboardError ? 'error' : 'loading'}
                        />
                      )}
                      {dashboard && dashboard.upcomingEvents.length === 0 ? (
                        <PanelState message="No hay eventos próximos." />
                      ) : null}
                    </div>
                  </article>
                </div>
              </section>
            ) : null}

            {activeSection === 'publish' ? (
              <section className="teacher-section">
                <div className="teacher-section-heading">
                  <p className="eyebrow">Publicar</p>
                  <h2 className="section-title">Crear tareas, eventos y mensajes</h2>
                </div>
                <div className="workflow-console-grid">
                  <article className="card">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Publicar</p>
                        <h2 className="section-title">Trabajo del aula</h2>
                      </div>
                    </div>
                    <div className="form">
                      <FormField label="Título" name="workflowTitle" onChange={(event) => setWorkflowTitle(event.target.value)} value={workflowTitle} />
                      <label className="form-field" htmlFor="workflowType">
                        <span>Tipo</span>
                        <select id="workflowType" onChange={(event) => setWorkflowType(event.target.value as 'homework' | 'exam' | 'assignment')} value={workflowType}>
                          <option value="homework">tarea</option>
                          <option value="exam">examen</option>
                          <option value="assignment">trabajo</option>
                        </select>
                      </label>
                      <FormField label="Fecha de entrega" name="workflowDueDate" onChange={(event) => setWorkflowDueDate(event.target.value)} type="datetime-local" value={workflowDueDate} />
                      <Button disabled={savingWorkflow === 'assignment' || !selectedClassroomId || !workflowTitle.trim()} onClick={() => void createAssignment()}>
                        {savingWorkflow === 'assignment' ? 'Publicando…' : 'Publicar trabajo'}
                      </Button>
                    </div>
                  </article>

                  <article className="card">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Calendario</p>
                        <h2 className="section-title">Evento del aula</h2>
                      </div>
                    </div>
                    <div className="form">
                      <FormField label="Título" name="teacherEventTitle" onChange={(event) => setEventTitle(event.target.value)} value={eventTitle} />
                      <FormField label="Inicia" name="teacherEventStartsAt" onChange={(event) => setEventStartsAt(event.target.value)} type="datetime-local" value={eventStartsAt} />
                      <Button disabled={savingWorkflow === 'event' || !selectedClassroomId || !eventTitle.trim()} onClick={() => void createClassroomEvent()}>
                        {savingWorkflow === 'event' ? 'Programando…' : 'Programar evento'}
                      </Button>
                    </div>
                  </article>

                  <article className="card">
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">Mensaje</p>
                        <h2 className="section-title">Conversación con familias y administración</h2>
                      </div>
                    </div>
                    <div className="form">
                      <FormField label="ID de usuario destinatario" name="teacherRecipientUserId" onChange={(event) => setRecipientUserId(event.target.value)} value={recipientUserId} />
                      <FormField label="Asunto" name="teacherMessageSubject" onChange={(event) => setMessageSubject(event.target.value)} value={messageSubject} />
                      <TextAreaField label="Mensaje" name="teacherMessageBody" onChange={(event) => setMessageBody(event.target.value)} rows={4} value={messageBody} />
                      <Button disabled={savingWorkflow === 'message' || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()} onClick={() => void sendMessage()}>
                        {savingWorkflow === 'message' ? 'Enviando…' : 'Enviar mensaje'}
                      </Button>
                    </div>
                  </article>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
