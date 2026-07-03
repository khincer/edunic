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
import { getSession } from '@/lib/auth';

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
    const session = getSession();

    if (!session) {
      return;
    }

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
        institutionId: session.user.institutionId,
      });
      setStudents(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load students');
    } finally {
      setLoading(false);
    }
  }

  async function createStudent() {
    const session = getSession();

    if (!session || !firstName.trim() || !lastName.trim()) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiRequest<ApiSingleResponse<Student>>('/students', {
        method: 'POST',
        institutionId: session.user.institutionId,
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
      setError(err instanceof Error ? err.message : 'Unable to create student');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Students</p>
          <h1 className="page-title">Student directory</h1>
          <p className="body-copy">Create students and review institution-scoped records.</p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Search</p>
              <h2 className="section-title">Find a student</h2>
            </div>
          </div>
          <div className="form">
            <FormField
              label="Name"
              name="studentSearch"
              onChange={(event) => setSearch(event.target.value)}
              value={search}
            />
            <Button onClick={() => void loadStudents(search)}>Search</Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Create</p>
              <h2 className="section-title">New student</h2>
            </div>
          </div>
          <div className="form">
            <FormField label="First name" name="firstName" onChange={(event) => setFirstName(event.target.value)} value={firstName} />
            <FormField label="Last name" name="lastName" onChange={(event) => setLastName(event.target.value)} value={lastName} />
            <FormField label="Date of birth" name="dateOfBirth" onChange={(event) => setDateOfBirth(event.target.value)} type="date" value={dateOfBirth} />
            <Button disabled={saving || !firstName.trim() || !lastName.trim()} onClick={() => void createStudent()}>
              {saving ? 'Creating...' : 'Create student'}
            </Button>
          </div>
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Records</p>
            <h2 className="section-title">{students.length} students</h2>
          </div>
        </div>
        {loading ? <p className="body-copy">Loading students...</p> : null}
        {!loading && students.length === 0 ? (
          <div className="empty-state body-copy">No students found.</div>
        ) : null}
        <div className="activity-list">
          {students.map((student) => (
            <article className="activity-row" key={student.id}>
              <span className="activity-mark">{student.firstName.slice(0, 1)}</span>
              <span>
                <strong>{student.fullName}</strong>
                <p className="field-help">
                  {student.dateOfBirth ?? 'No birth date'} - created{' '}
                  {student.createdAt ? formatDate(student.createdAt) : 'n/a'}
                </p>
              </span>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
