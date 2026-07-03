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
} from '@/lib/api';
import { getSession } from '@/lib/auth';

export default function AdminGradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subject, setSubject] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [score, setScore] = useState('90');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadGrades();
  }, []);

  async function loadGrades(nextSubject = subject) {
    const session = getSession();

    if (!session) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        subject: nextSubject,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const result = await apiRequest<ApiListResponse<Grade>>(`/grades${query}`, {
        institutionId: session.user.institutionId,
      });
      setGrades(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load grades');
    } finally {
      setLoading(false);
    }
  }

  async function createGrade() {
    const session = getSession();

    if (!session || !enrollmentId.trim() || !newSubject.trim()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<Grade>>('/grades', {
        method: 'POST',
        institutionId: session.user.institutionId,
        body: {
          enrollmentId,
          subject: newSubject,
          score: Number(score),
        },
      });
      setNewSubject('');
      await loadGrades();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create grade');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Grades</p>
          <h1 className="page-title">Grade submissions</h1>
          <p className="body-copy">Review recent grades and submit demo grade records.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Filter</p>
              <h2 className="section-title">Subject lookup</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Subject" name="subject" onChange={(event) => setSubject(event.target.value)} value={subject} />
            <Button onClick={() => void loadGrades(subject)}>Search</Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2 className="section-title">New grade</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="Enrollment ID" name="enrollmentId" onChange={(event) => setEnrollmentId(event.target.value)} value={enrollmentId} />
            <FormField label="Subject" name="newSubject" onChange={(event) => setNewSubject(event.target.value)} value={newSubject} />
            <FormField label="Score" max={100} min={0} name="score" onChange={(event) => setScore(event.target.value)} type="number" value={score} />
            <Button disabled={saving || !enrollmentId.trim() || !newSubject.trim()} onClick={() => void createGrade()}>
              {saving ? 'Submitting...' : 'Submit grade'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Records</p>
            <h2 className="section-title">{grades.length} grades</h2>
          </div>
        </div>
        {loading ? <p className="body-copy">Loading grades...</p> : null}
        {!loading && grades.length === 0 ? <div className="empty-state body-copy">No grades found.</div> : null}
        <div className="activity-list">
          {grades.map((grade) => (
            <article className="activity-row" key={grade.id}>
              <span className="activity-mark">{grade.score}</span>
              <span>
                <strong>{grade.subject}</strong>
                <p className="field-help">
                  Enrollment {grade.enrollmentId} - {grade.createdAt ? formatDate(grade.createdAt) : 'No timestamp'}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
