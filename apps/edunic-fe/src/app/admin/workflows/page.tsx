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
import { getSession } from '@/lib/auth';

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
  const [assignmentTitle, setAssignmentTitle] = useState('Demo homework packet');
  const [assignmentType, setAssignmentType] = useState<'assignment' | 'homework' | 'exam'>('homework');
  const [assignmentClassroomId, setAssignmentClassroomId] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState(getLocalDateTime(2));
  const [eventTitle, setEventTitle] = useState('Family conference block');
  const [eventType, setEventType] = useState('school');
  const [eventClassroomId, setEventClassroomId] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState(getLocalDateTime(3));
  const [recipientUserId, setRecipientUserId] = useState('');
  const [messageSubject, setMessageSubject] = useState('Workflow demo note');
  const [messageBody, setMessageBody] = useState('This message was sent from the workflow console.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadWorkflowData();
  }, []);

  async function loadWorkflowData() {
    const session = getSession();

    if (!session) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const headers = { institutionId: session.user.institutionId };
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
      setError(err instanceof Error ? err.message : 'Unable to load workflow data');
    } finally {
      setLoading(false);
    }
  }

  async function createAssignment() {
    const session = getSession();

    if (!session || !assignmentTitle.trim()) {
      return;
    }

    setSaving('assignment');
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowAssignment>>('/assignments', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          classroomId: assignmentClassroomId || undefined,
          title: assignmentTitle,
          type: assignmentType,
          status: 'published',
          dueDate: toIsoDateTime(assignmentDueDate),
        },
      });
      setNotice('Assignment published.');
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create assignment');
    } finally {
      setSaving('');
    }
  }

  async function updateAssignmentStatus(assignmentId: string, status: string) {
    const session = getSession();

    if (!session) {
      return;
    }

    setSaving(assignmentId);
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowAssignment>>(`/assignments/${assignmentId}`, {
        method: 'PATCH',
        institutionId: session.user.institutionId,
        body: { status },
      });
      setNotice(`Assignment marked ${status}.`);
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update assignment');
    } finally {
      setSaving('');
    }
  }

  async function createEvent() {
    const session = getSession();

    if (!session || !eventTitle.trim() || !eventStartsAt) {
      return;
    }

    setSaving('event');
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowEvent>>('/school-events', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          classroomId: eventClassroomId || null,
          title: eventTitle,
          eventType,
          startsAt: new Date(eventStartsAt).toISOString(),
        },
      });
      setNotice('Event scheduled.');
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create event');
    } finally {
      setSaving('');
    }
  }

  async function sendMessage() {
    const session = getSession();

    if (!session || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()) {
      return;
    }

    setSaving('message');
    setError('');
    setNotice('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowMessage>>('/messages', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          recipientUserId,
          subject: messageSubject,
          body: messageBody,
        },
      });
      setNotice('Message sent.');
      setMessageBody('');
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSaving('');
    }
  }

  async function markMessageRead(messageId: string) {
    const session = getSession();

    if (!session) {
      return;
    }

    setSaving(messageId);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<WorkflowMessage>>(`/messages/${messageId}/read`, {
        method: 'PATCH',
        institutionId: session.user.institutionId,
      });
      await loadWorkflowData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to mark message read');
    } finally {
      setSaving('');
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Workflows</p>
          <h1 className="page-title">Assignments, calendar, and messaging</h1>
          <p className="body-copy">Operate the non-billing demo workflows from one tenant-scoped console.</p>
        </div>
        <Button onClick={() => void loadWorkflowData()} variant="secondary">
          Refresh
        </Button>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-info">{notice}</div> : null}

      <section className="workflow-console-grid">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Assignments</p>
              <h2 className="section-title">Publish work</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Title" name="assignmentTitle" onChange={(event) => setAssignmentTitle(event.target.value)} value={assignmentTitle} />
            <label className="form-field" htmlFor="assignmentType">
              <span>Type</span>
              <select id="assignmentType" onChange={(event) => setAssignmentType(event.target.value as 'assignment' | 'homework' | 'exam')} value={assignmentType}>
                <option value="assignment">assignment</option>
                <option value="homework">homework</option>
                <option value="exam">exam</option>
              </select>
            </label>
            <label className="form-field" htmlFor="assignmentClassroom">
              <span>Classroom</span>
              <select id="assignmentClassroom" onChange={(event) => setAssignmentClassroomId(event.target.value)} value={assignmentClassroomId}>
                <option value="">School-wide</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <FormField label="Due date" name="assignmentDueDate" onChange={(event) => setAssignmentDueDate(event.target.value)} type="datetime-local" value={assignmentDueDate} />
            <Button disabled={saving === 'assignment' || !assignmentTitle.trim()} onClick={() => void createAssignment()}>
              {saving === 'assignment' ? 'Publishing...' : 'Publish assignment'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Calendar</p>
              <h2 className="section-title">Schedule event</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Title" name="eventTitle" onChange={(event) => setEventTitle(event.target.value)} value={eventTitle} />
            <FormField label="Event type" name="eventType" onChange={(event) => setEventType(event.target.value)} value={eventType} />
            <label className="form-field" htmlFor="eventClassroom">
              <span>Classroom</span>
              <select id="eventClassroom" onChange={(event) => setEventClassroomId(event.target.value)} value={eventClassroomId}>
                <option value="">School-wide</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
              </select>
            </label>
            <FormField label="Starts at" name="eventStartsAt" onChange={(event) => setEventStartsAt(event.target.value)} type="datetime-local" value={eventStartsAt} />
            <Button disabled={saving === 'event' || !eventTitle.trim()} onClick={() => void createEvent()}>
              {saving === 'event' ? 'Scheduling...' : 'Schedule event'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Messaging</p>
              <h2 className="section-title">Send thread</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Recipient user ID" name="recipientUserId" onChange={(event) => setRecipientUserId(event.target.value)} value={recipientUserId} />
            <FormField label="Subject" name="messageSubject" onChange={(event) => setMessageSubject(event.target.value)} value={messageSubject} />
            <TextAreaField label="Message" name="messageBody" onChange={(event) => setMessageBody(event.target.value)} rows={4} value={messageBody} />
            <Button disabled={saving === 'message' || !recipientUserId.trim() || !messageSubject.trim() || !messageBody.trim()} onClick={() => void sendMessage()}>
              {saving === 'message' ? 'Sending...' : 'Send message'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Assignments</p>
              <h2 className="section-title">{assignments.length} visible items</h2>
            </div>
          </div>
          <div className="activity-list">
            {assignments.map((assignment) => (
              <article className="activity-row activity-row-action" key={assignment.id}>
                <span className="activity-mark">{assignment.type.slice(0, 1)}</span>
                <span>
                  <strong>{assignment.title}</strong>
                  <p className="field-help">
                    {assignment.classroomName ?? 'School-wide'} - {assignment.status}
                  </p>
                </span>
                <Button disabled={saving === assignment.id || assignment.status === 'reviewed'} onClick={() => void updateAssignmentStatus(assignment.id, 'reviewed')} variant="secondary">
                  Review
                </Button>
              </article>
            ))}
            {!loading && assignments.length === 0 ? <div className="empty-state body-copy">No assignments found.</div> : null}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Events</p>
              <h2 className="section-title">{events.length} calendar items</h2>
            </div>
          </div>
          <div className="activity-list">
            {events.map((event) => (
              <article className="activity-row" key={event.id}>
                <span className="activity-mark">E</span>
                <span>
                  <strong>{event.title}</strong>
                  <p className="field-help">
                    {event.classroomName ?? 'School-wide'} - {event.startsAt.slice(0, 10)}
                  </p>
                </span>
              </article>
            ))}
            {!loading && events.length === 0 ? <div className="empty-state body-copy">No events found.</div> : null}
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Inbox</p>
            <h2 className="section-title">{messages.filter((message) => !message.readAt).length} unread messages</h2>
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
                {message.readAt ? 'Read' : 'Mark read'}
              </Button>
            </article>
          ))}
          {!loading && messages.length === 0 ? <div className="empty-state body-copy">No messages found.</div> : null}
        </div>
      </section>
    </AdminShell>
  );
}
