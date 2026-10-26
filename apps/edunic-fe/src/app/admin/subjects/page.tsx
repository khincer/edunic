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
  type ApiListResponse,
  type ApiSingleResponse,
  type Classroom,
  type Subject,
  type Teacher,
  type Topic,
} from '@/lib/api';

// SUB-01..03: the director creates the materias (and their temas), offers them
// in grade levels and makes teachers responsible for them.
export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [topicSubjectId, setTopicSubjectId] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicName, setTopicName] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [classroomSubjects, setClassroomSubjects] = useState<Subject[]>([]);
  const [classroomAddId, setClassroomAddId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [teacherSubjects, setTeacherSubjects] = useState<Subject[]>([]);
  const [teacherAddId, setTeacherAddId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    void loadTopics(topicSubjectId);
  }, [topicSubjectId]);

  useEffect(() => {
    void loadClassroomSubjects(classroomId);
  }, [classroomId]);

  useEffect(() => {
    void loadTeacherSubjects(teacherId);
  }, [teacherId]);

  async function loadCatalog() {
    setLoading(true);
    setError('');

    try {
      const [subjectResult, classroomResult, teacherResult] = await Promise.all([
        apiRequest<ApiListResponse<Subject>>('/subjects'),
        apiRequest<ApiListResponse<Classroom>>('/classrooms?limit=100'),
        apiRequest<ApiListResponse<Teacher>>('/teachers?limit=100'),
      ]);
      setSubjects(subjectResult.data);
      setClassrooms(classroomResult.data);
      setTeachers(teacherResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load materias');
    } finally {
      setLoading(false);
    }
  }

  async function loadTopics(subjectId: string) {
    if (!subjectId) {
      setTopics([]);
      return;
    }

    try {
      const result = await apiRequest<ApiListResponse<Topic>>(`/subjects/${subjectId}/topics`);
      setTopics(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load temas');
    }
  }

  async function loadClassroomSubjects(id: string) {
    if (!id) {
      setClassroomSubjects([]);
      return;
    }

    try {
      const result = await apiRequest<ApiListResponse<Subject>>(`/subjects/classroom/${id}`);
      setClassroomSubjects(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the grade level');
    }
  }

  async function loadTeacherSubjects(id: string) {
    if (!id) {
      setTeacherSubjects([]);
      return;
    }

    try {
      const result = await apiRequest<ApiListResponse<Subject>>(`/subjects/teacher/${id}`);
      setTeacherSubjects(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the teacher's materias");
    }
  }

  async function run(action: () => Promise<void>, success: string, failure: string) {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      await action();
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setSaving(false);
    }
  }

  function createSubject() {
    void run(
      async () => {
        await apiRequest<ApiSingleResponse<Subject>>('/subjects', {
          method: 'POST',
          body: {
            name,
            code: code.trim() || undefined,
            description: description.trim() || undefined,
          },
        });
        setName('');
        setCode('');
        setDescription('');
        await loadCatalog();
      },
      'Materia created.',
      'Unable to create the materia'
    );
  }

  function toggleActive(subject: Subject) {
    void run(
      async () => {
        await apiRequest(`/subjects/${subject.id}`, {
          method: 'PATCH',
          body: { active: !subject.active },
        });
        await loadCatalog();
      },
      subject.active ? 'Materia deactivated.' : 'Materia activated.',
      'Unable to update the materia'
    );
  }

  function addTopic() {
    void run(
      async () => {
        await apiRequest(`/subjects/${topicSubjectId}/topics`, {
          method: 'POST',
          body: { name: topicName },
        });
        setTopicName('');
        await loadTopics(topicSubjectId);
      },
      'Tema added.',
      'Unable to add the tema'
    );
  }

  function offerInClassroom() {
    void run(
      async () => {
        await apiRequest(`/subjects/classroom/${classroomId}`, {
          method: 'POST',
          body: { subjectIds: [classroomAddId] },
        });
        setClassroomAddId('');
        await loadClassroomSubjects(classroomId);
      },
      'Materia offered in the grade level.',
      'Unable to offer the materia'
    );
  }

  function removeFromClassroom(subjectId: string) {
    void run(
      async () => {
        await apiRequest(`/subjects/classroom/${classroomId}/${subjectId}`, {
          method: 'DELETE',
        });
        await loadClassroomSubjects(classroomId);
      },
      'Materia removed from the grade level.',
      'Unable to remove the materia'
    );
  }

  function assignToTeacher() {
    void run(
      async () => {
        await apiRequest(`/subjects/teacher/${teacherId}`, {
          method: 'POST',
          body: { subjectIds: [teacherAddId] },
        });
        setTeacherAddId('');
        await loadTeacherSubjects(teacherId);
      },
      'Materia assigned to the teacher.',
      'Unable to assign the materia'
    );
  }

  function removeFromTeacher(subjectId: string) {
    void run(
      async () => {
        await apiRequest(`/subjects/teacher/${teacherId}/${subjectId}`, {
          method: 'DELETE',
        });
        await loadTeacherSubjects(teacherId);
      },
      'Materia removed from the teacher.',
      'Unable to remove the materia'
    );
  }

  const activeSubjects = subjects.filter((subject) => subject.active);

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Materias</p>
          <h1 className="page-title">Subjects</h1>
          <p className="body-copy">
            Create materias and their temas, offer them in each grade level and assign them to
            teachers.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-success">{notice}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2 className="section-title">New materia</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Name" name="subjectName" onChange={(event) => setName(event.target.value)} value={name} />
            <FormField label="Code" name="subjectCode" onChange={(event) => setCode(event.target.value)} value={code} />
            <FormField
              label="Description"
              name="subjectDescription"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            <Button disabled={saving || !name.trim()} onClick={createSubject}>
              Create materia
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Temas</p>
              <h2 className="section-title">Topics of a materia</h2>
            </div>
          </div>
          <div className="form">
            <div className="form-field">
              <label htmlFor="topicSubject">Materia</label>
              <select id="topicSubject" onChange={(event) => setTopicSubjectId(event.target.value)} value={topicSubjectId}>
                <option value="">Choose a materia</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            {topicSubjectId ? (
              <>
                <div className="button-row">
                  {topics.length === 0 ? <span className="field-help">No temas yet.</span> : null}
                  {topics.map((topic) => (
                    <span className="badge badge-blue" key={topic.id}>
                      {topic.name}
                    </span>
                  ))}
                </div>
                <FormField label="New tema" name="topicName" onChange={(event) => setTopicName(event.target.value)} value={topicName} />
                <Button disabled={saving || !topicName.trim()} onClick={addTopic} variant="secondary">
                  Add tema
                </Button>
              </>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2 className="section-title">
              {subjects.length} {subjects.length === 1 ? 'materia' : 'materias'}
            </h2>
          </div>
        </div>
        {loading ? (
          <PanelState message="Loading materias..." tone="loading" />
        ) : (
          <DataTable
            columns={[
              { key: 'name', header: 'Materia', render: (subject) => <strong>{subject.name}</strong> },
              { key: 'code', header: 'Code', render: (subject) => subject.code ?? '-' },
              {
                key: 'status',
                header: 'Status',
                render: (subject) => (
                  <span className={subject.active ? 'badge badge-green' : 'badge'}>
                    {subject.active ? 'Active' : 'Inactive'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (subject) => (
                  <Button disabled={saving} onClick={() => toggleActive(subject)} variant="ghost">
                    {subject.active ? 'Deactivate' : 'Activate'}
                  </Button>
                ),
              },
            ]}
            emptyMessage="No materias yet."
            getRowKey={(subject) => subject.id}
            rows={subjects}
          />
        )}
      </section>

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Grade levels</p>
              <h2 className="section-title">Materias offered</h2>
            </div>
          </div>
          <div className="form">
            <div className="form-field">
              <label htmlFor="offerClassroom">Classroom</label>
              <select id="offerClassroom" onChange={(event) => setClassroomId(event.target.value)} value={classroomId}>
                <option value="">Choose a classroom</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {formatClassroom(classroom)}
                  </option>
                ))}
              </select>
            </div>
            {classroomId ? (
              <SubjectLinks
                addId={classroomAddId}
                available={activeSubjects.filter(
                  (subject) => !classroomSubjects.some((linked) => linked.id === subject.id)
                )}
                linked={classroomSubjects}
                onAdd={offerInClassroom}
                onAddIdChange={setClassroomAddId}
                onRemove={removeFromClassroom}
                saving={saving}
                selectId="classroomAddSubject"
              />
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Teachers</p>
              <h2 className="section-title">Materias a teacher is responsible for</h2>
            </div>
          </div>
          <div className="form">
            <div className="form-field">
              <label htmlFor="subjectTeacher">Teacher</label>
              <select id="subjectTeacher" onChange={(event) => setTeacherId(event.target.value)} value={teacherId}>
                <option value="">Choose a teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.email}
                  </option>
                ))}
              </select>
            </div>
            {teacherId ? (
              <SubjectLinks
                addId={teacherAddId}
                available={activeSubjects.filter(
                  (subject) => !teacherSubjects.some((linked) => linked.id === subject.id)
                )}
                linked={teacherSubjects}
                onAdd={assignToTeacher}
                onAddIdChange={setTeacherAddId}
                onRemove={removeFromTeacher}
                saving={saving}
                selectId="teacherAddSubject"
              />
            ) : null}
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}

type SubjectLinksProps = {
  linked: Subject[];
  available: Subject[];
  addId: string;
  selectId: string;
  saving: boolean;
  onAddIdChange: (id: string) => void;
  onAdd: () => void;
  onRemove: (subjectId: string) => void;
};

function SubjectLinks({
  linked,
  available,
  addId,
  selectId,
  saving,
  onAddIdChange,
  onAdd,
  onRemove,
}: SubjectLinksProps) {
  return (
    <>
      <div className="button-row">
        {linked.length === 0 ? <span className="field-help">None yet.</span> : null}
        {linked.map((subject) => (
          <span className="badge badge-blue" key={subject.id}>
            {subject.name}{' '}
            <button
              aria-label={`Remove ${subject.name}`}
              className="badge-remove"
              disabled={saving}
              onClick={() => onRemove(subject.id)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="form-field">
        <label htmlFor={selectId}>Add a materia</label>
        <select id={selectId} onChange={(event) => onAddIdChange(event.target.value)} value={addId}>
          <option value="">Choose a materia</option>
          {available.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </div>
      <Button disabled={saving || !addId} onClick={onAdd} variant="secondary">
        Add
      </Button>
    </>
  );
}
