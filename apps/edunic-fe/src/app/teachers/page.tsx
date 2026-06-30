'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
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
} from '@/lib/api';
import { clearSession, getSession, type AdminSession } from '@/lib/auth';

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeachersPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [gradeSubject, setGradeSubject] = useState('Mathematics');
  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canUseTeacherTools = session?.user.role === 'teacher' || session?.user.role === 'admin';
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

    void loadClassrooms(session.user.institutionId);
  }, [canUseTeacherTools, session]);

  useEffect(() => {
    if (!session || !selectedClassroomId) {
      setEnrollments([]);
      return;
    }

    void loadRoster(session.user.institutionId, selectedClassroomId);
  }, [selectedClassroomId, session]);

  useEffect(() => {
    if (!session || enrollments.length === 0) {
      setAttendanceStatus({});
      setAttendanceRecords({});
      return;
    }

    void loadAttendanceForDate(session.user.institutionId, enrollments, attendanceDate);
  }, [attendanceDate, enrollments, session]);

  function handleSignOut() {
    clearSession();
    setSession(null);
    setClassrooms([]);
    setSelectedClassroomId('');
    setEnrollments([]);
    setNotice('');
    router.replace('/teachers/login');
  }

  async function loadClassrooms(nextInstitutionId: string) {
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<ApiListResponse<Classroom>>(
        '/classrooms?limit=100&sortBy=gradeLevel&sortOrder=asc',
        { institutionId: nextInstitutionId }
      );
      setClassrooms(result.data);
      setSelectedClassroomId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load classrooms');
    } finally {
      setLoading(false);
    }
  }

  async function loadRoster(nextInstitutionId: string, classroomId: string) {
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
        { institutionId: nextInstitutionId }
      );
      setEnrollments(result.data);
      setGradeScores({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load roster');
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceForDate(
    nextInstitutionId: string,
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
            { institutionId: nextInstitutionId }
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
      setError(err instanceof Error ? err.message : 'Unable to load attendance');
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
                institutionId: session.user.institutionId,
                body: { status },
              }
            );
          }

          return apiRequest<ApiSingleResponse<AttendanceRecord>>('/attendance', {
            method: 'POST',
            institutionId: session.user.institutionId,
            body: {
              enrollmentId: enrollment.id,
              date: attendanceDate,
              status,
            },
          });
        })
      );
      await loadAttendanceForDate(session.user.institutionId, enrollments, attendanceDate);
      setNotice('Attendance saved for the selected date.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save attendance');
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
      setError('Enter at least one score before submitting grades.');
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
            institutionId: session.user.institutionId,
            body: {
              enrollmentId: enrollment.id,
              subject: gradeSubject,
              score: Number(score),
            },
          })
        )
      );
      setGradeScores({});
      setNotice(`Submitted ${scores.length} grade${scores.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit grades');
    } finally {
      setSavingGrades(false);
    }
  }

  if (!ready || !session) {
    return (
      <main className="portal-page">
        <nav className="portal-topnav" aria-label="Teacher section navigation">
          <Link href="/">Edunic</Link>
          <div>
            <Link href="/admin">Admin</Link>
            <Link href="/students">Students</Link>
          </div>
        </nav>

        <section className="empty-state body-copy">Opening teacher workspace...</section>
      </main>
    );
  }

  return (
    <main className="portal-page">
      <nav className="portal-topnav" aria-label="Teacher section navigation">
        <Link href="/">Edunic</Link>
        <div>
          <Link href="/admin">Admin</Link>
          <Link href="/students">Students</Link>
          <button className="link-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </nav>

      <section className="teacher-header">
        <div>
          <p className="eyebrow">Teacher workspace</p>
          <h1 className="page-title">Attendance and grade submission.</h1>
          <p className="body-copy">
            {session.user.email} is working inside institution {session.user.institutionId}.
          </p>
        </div>
        <div className="teacher-summary">
          <div>
            <span>Present</span>
            <strong>{attendanceSummary.present}</strong>
          </div>
          <div>
            <span>Late</span>
            <strong>{attendanceSummary.late}</strong>
          </div>
          <div>
            <span>Absent</span>
            <strong>{attendanceSummary.absent}</strong>
          </div>
        </div>
      </section>

      {!canUseTeacherTools ? (
        <div className="alert alert-error">
          This account cannot use teacher tools. Sign in as a teacher or admin.
        </div>
      ) : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-info">{notice}</div> : null}

      {canUseTeacherTools ? (
        <section className="teacher-layout">
          <aside className="card teacher-controls">
            <div className="form-field">
              <label htmlFor="classroom">Classroom</label>
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
              label="Attendance date"
              name="attendanceDate"
              onChange={(event) => setAttendanceDate(event.target.value)}
              type="date"
              value={attendanceDate}
            />
            <FormField
              label="Grade subject"
              name="gradeSubject"
              onChange={(event) => setGradeSubject(event.target.value)}
              required
              type="text"
              value={gradeSubject}
            />
            <div className="classroom-context">
              <span className="badge badge-blue">{selectedClassroom?.name ?? 'No classroom'}</span>
              <p className="body-copy">
                {loading
                  ? 'Loading classroom data...'
                  : `${enrollments.length} active enrollment${enrollments.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </aside>

          <section className="card teacher-roster">
            <div className="page-header">
              <div>
                <p className="eyebrow">Daily roster</p>
                <h2 className="section-title">Mark attendance and enter scores</h2>
              </div>
              <div className="button-row">
                <Button
                  disabled={savingAttendance || enrollments.length === 0}
                  onClick={saveAttendance}
                >
                  {savingAttendance ? 'Saving...' : 'Save attendance'}
                </Button>
                <Button
                  disabled={savingGrades || enrollments.length === 0 || !gradeSubject.trim()}
                  onClick={submitGrades}
                  variant="secondary"
                >
                  {savingGrades ? 'Submitting...' : 'Submit grades'}
                </Button>
              </div>
            </div>

            {enrollments.length === 0 && !loading ? (
              <div className="empty-state body-copy">
                No active enrollments were found for this classroom.
              </div>
            ) : null}

            <div className="teacher-student-list">
              {enrollments.map((enrollment) => (
                <article className="teacher-student-row" key={enrollment.id}>
                  <div>
                    <strong>{enrollment.student.fullName}</strong>
                    <p className="field-help">Enrollment {enrollment.id}</p>
                  </div>
                  <div className="attendance-toggle" aria-label={`${enrollment.student.fullName} attendance`}>
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
                        {status}
                      </button>
                    ))}
                  </div>
                  <label className="score-cell">
                    <span>Score</span>
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
        </section>
      ) : null}
    </main>
  );
}
