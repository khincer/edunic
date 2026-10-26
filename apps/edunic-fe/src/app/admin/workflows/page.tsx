'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FormField, TextAreaField } from '@/components/form-field';
import {
  apiRequest,
  buildQuery,
  type ApiListResponse,
  type ApiSingleResponse,
  type Classroom,
  type WorkflowAssignment,
  type WorkflowEvent,
  type WorkflowMessage,
} from '@/lib/api';

const assignmentStatusLabels: Record<string, string> = {
  published: 'Publicada',
  reviewed: 'Revisada',
};

function getLocalDateTime(offsetDays = 1) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  value.setHours(9, 0, 0, 0);
  return value.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export default function AdminWorkflowsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<WorkflowAssignment[]>([]);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [messages, setMessages] = useState<WorkflowMessage[]>([]);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentType, setAssignmentType] = useState<'assignment' | 'homework' | 'exam'>('homework');
  const [assignmentClassroomId, setAssignmentClassroomId] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState(getLocalDateTime(2));
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('school');
  const [eventClassroomId, setEventClassroomId] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState(getLocalDateTime(3));
  const [recipientUserId, setRecipientUserId] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadWorkflowData();
  }, []);

  async function loadWorkflowData() {


    setLoading(true);
    setError('');

    try {
      const headers = {};
      const [classroomResult, assignmentResult, eventResult, messageResult] =
        await Promise.all([
          apiRequest<ApiListResponse<Classroom>>(
            `/classrooms${buildQuery({ limit: 100, sortBy: 'gradeLevel', sortOrder: 'asc' })}`,
            headers
          ),
          apiRequest<ApiListResponse<WorkflowAssignment>>(
            `/assignments${buildQuery({ limit: 50 })}`,
            headers
          ),
          apiRequest<ApiListResponse<WorkflowEvent>>(
            `/school-events${buildQuery({ limit: 50 })}`,
            headers
          ),
          apiRequest<ApiListResponse<WorkflowMessage>>(
            `/messages${buildQuery({ limit: 50 })}`,
            headers
          ),
        ]);
      setClassrooms(classroomResult.data);
      setAssignments(assignmentResult.data);
      setEvents(eventResult.data);
      setMessages(messageResult.data);
      setAssignmentClassroomId((current) => current || classroomResult.data[0]?.id || '');
      setEventClassroomId((current) => current || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos del flujo de trabajo');
    } finally {
      setLoading(false);
    }
  }

  async function createAssignment() {

    if (!assignmentTitle.trim()) {
      return;
    }

    setSaving('assignment');
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowAssignment>>('/assignments', {
        method: 'POST',
        body: {
          classroomId: assignmentClassroomId || undefined,
          title: assignmentTitle,
          type: assignmentType,
          status: 'published',
          dueDate: toIsoDateTime(assignmentDueDate),
        },
      });
      setNotice('Tarea publicada.');
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea');
    } finally {
      setSaving('');
    }
  }

  async function updateAssignmentStatus(assignmentId: string, status: string) {


    setSaving(assignmentId);
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowAssignment>>(`/assignments/${assignmentId}`, {
        method: 'PATCH',
        body: { status },
      });
      setNotice(`Tarea marcada como ${assignmentStatusLabels[status] ?? status}.`);
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la tarea');
    } finally {
      setSaving('');
    }
  }

  async function createEvent() {

    if (!eventTitle.trim() || !eventStartsAt) {
      return;
    }

    setSaving('event');
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowEvent>>('/school-events', {
        method: 'POST',
        body: {
          classroomId: eventClassroomId || null,
          title: eventTitle,
          eventType,
          startsAt: new Date(eventStartsAt).toISOString(),
        },
      });
      setNotice('Evento programado.');
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el evento');
    } finally {
      setSaving('');
    }
  }

  async function sendMessage() {

    if (!recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()) {
      return;
    }

    setSaving('message');
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowMessage>>('/messages', {
        method: 'POST',
        body: {
          recipientUserId,
          subject: messageSubject,
          body: messageBody,
        },
      });
      setNotice('Mensaje enviado.');
      setMessageBody('');
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSaving('');
    }
  }

  async function markMessageRead(messageId: string) {


    setSaving(messageId);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowMessage>>(`/messages/${messageId}/read`, {
        method: 'PATCH',
      });
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar el mensaje como leído');
    } finally {
      setSaving('');
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Flujos de trabajo</p>
          <h1 className="page-title">Tareas, calendario y mensajería</h1>
          <p className="body-copy">Publique tareas, programe eventos y envíe mensajes a las familias.</p>
        </div>
        <Button onClick={() => void loadWorkflowData()} variant="secondary">
          Actualizar
        </Button>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-info">{notice}</div> : null}

      <section className="workflow-console-grid">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Tareas</p>
              <h2 className="section-title">Publicar trabajo</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Título" name="assignmentTitle" onChange={(event) => setAssignmentTitle(event.target.value)} value={assignmentTitle} />
            <label className="form-field" htmlFor="assignmentType">
              <span>Tipo</span>
              <select id="assignmentType" onChange={(event) => setAssignmentType(event.target.value as 'assignment' | 'homework' | 'exam')} value={assignmentType}>
                <option value="assignment">Tarea</option>
                <option value="homework">Deberes</option>
                <option value="exam">Examen</option>
              </select>
            </label>
            <label className="form-field" htmlFor="assignmentClassroom">
              <span>Aula</span>
              <select id="assignmentClassroom" onChange={(event) => setAssignmentClassroomId(event.target.value)} value={assignmentClassroomId}>
                <option value="">Todo el colegio</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <FormField label="Fecha de entrega" name="assignmentDueDate" onChange={(event) => setAssignmentDueDate(event.target.value)} type="datetime-local" value={assignmentDueDate} />
            <Button disabled={saving === 'assignment' || !assignmentTitle.trim()} onClick={() => void createAssignment()}>
              {saving === 'assignment' ? 'Publicando…' : 'Publicar tarea'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Calendario</p>
              <h2 className="section-title">Programar evento</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Título" name="eventTitle" onChange={(event) => setEventTitle(event.target.value)} value={eventTitle} />
            <FormField label="Tipo de evento" name="eventType" onChange={(event) => setEventType(event.target.value)} value={eventType} />
            <label className="form-field" htmlFor="eventClassroom">
              <span>Aula</span>
              <select id="eventClassroom" onChange={(event) => setEventClassroomId(event.target.value)} value={eventClassroomId}>
                <option value="">Todo el colegio</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <FormField label="Comienza" name="eventStartsAt" onChange={(event) => setEventStartsAt(event.target.value)} type="datetime-local" value={eventStartsAt} />
            <Button disabled={saving === 'event' || !eventTitle.trim()} onClick={() => void createEvent()}>
              {saving === 'event' ? 'Programando…' : 'Programar evento'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Mensajería</p>
              <h2 className="section-title">Enviar mensaje</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="ID de usuario destinatario" name="recipientUserId" onChange={(event) => setRecipientUserId(event.target.value)} value={recipientUserId} />
            <FormField label="Asunto" name="messageSubject" onChange={(event) => setMessageSubject(event.target.value)} value={messageSubject} />
            <TextAreaField label="Mensaje" name="messageBody" onChange={(event) => setMessageBody(event.target.value)} rows={4} value={messageBody} />
            <Button disabled={saving === 'message' || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()} onClick={() => void sendMessage()}>
              {saving === 'message' ? 'Enviando…' : 'Enviar mensaje'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Tareas</p>
              <h2 className="section-title">{assignments.length} elementos visibles</h2>
            </div>
          </div>
          <div className="activity-list">
            {assignments.map((assignment) => (
              <article className="activity-row activity-row-action" key={assignment.id}>
                <span className="activity-mark">{assignment.type.slice(0, 1)}</span>
                <span>
                  <strong>{assignment.title}</strong>
                  <p className="field-help">
                    {assignment.classroomName ?? 'Todo el colegio'} - {assignmentStatusLabels[assignment.status] ?? assignment.status}
                  </p>
                </span>
                <Button disabled={saving === assignment.id || assignment.status === 'reviewed'} onClick={() => void updateAssignmentStatus(assignment.id, 'reviewed')} variant="secondary">
                  Revisar
                </Button>
              </article>
            ))}
            {!loading && assignments.length === 0 ? <div className="empty-state body-copy">No se encontraron tareas.</div> : null}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Eventos</p>
              <h2 className="section-title">{events.length} elementos del calendario</h2>
            </div>
          </div>
          <div className="activity-list">
            {events.map((event) => (
              <article className="activity-row" key={event.id}>
                <span className="activity-mark">E</span>
                <span>
                  <strong>{event.title}</strong>
                  <p className="field-help">
                    {event.classroomName ?? 'Todo el colegio'} - {event.startsAt.slice(0, 10)}
                  </p>
                </span>
              </article>
            ))}
            {!loading && events.length === 0 ? <div className="empty-state body-copy">No se encontraron eventos.</div> : null}
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Bandeja de entrada</p>
            <h2 className="section-title">{messages.filter((message) => !message.readAt).length} mensajes sin leer</h2>
          </div>
        </div>
        <div className="activity-list">
          {messages.map((message) => (
            <article className="activity-row activity-row-action" data-unread={!message.readAt} key={message.id}>
              <span className="activity-mark">M</span>
              <span>
                <strong>{message.subject}</strong>
                <p className="field-help">{message.body}</p>
              </span>
              <Button disabled={Boolean(message.readAt) || saving === message.id} onClick={() => void markMessageRead(message.id)} variant="secondary">
                {message.readAt ? 'Leída' : 'Marcar como leída'}
              </Button>
            </article>
          ))}
          {!loading && messages.length === 0 ? <div className="empty-state body-copy">No se encontraron mensajes.</div> : null}
        </div>
      </section>
    </AdminShell>
  );
}
