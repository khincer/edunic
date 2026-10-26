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
  buildQuery,
  downloadFile,
  formatClassroom,
  formatDate,
  type ApiListResponse,
  type Classroom,
  type ReportHistoryEntry,
  type ReportHistoryPage,
  type Student,
} from '@/lib/api';

const HISTORY_PAGE_SIZE = 20;

const REPORT_TYPE_LABELS: Record<string, string> = {
  academic_summary: 'Academic summary',
  academic_summary_pdf: 'Academic summary (PDF)',
  grades_csv: 'Grades (CSV)',
};

// REP-01 / REP-02 / REP-03: the director downloads a student's academic
// summary as PDF, exports the grades of a year as CSV (the whole school, a
// classroom or a student), and reviews the history of every export.
export default function AdminReportsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [exportClassroomId, setExportClassroomId] = useState('');
  const [exportStudentId, setExportStudentId] = useState('');
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadDirectory();
  }, []);

  useEffect(() => {
    void loadHistory(historyOffset);
  }, [historyOffset]);

  const yearNumber = Number(year);
  const validYear = Number.isInteger(yearNumber) && yearNumber >= 2000 && yearNumber <= 2100;

  async function loadDirectory() {
    setLoading(true);
    setError('');

    try {
      const [studentResult, classroomResult] = await Promise.all([
        apiRequest<ApiListResponse<Student>>('/students?limit=100&sortBy=lastName&sortOrder=asc'),
        apiRequest<ApiListResponse<Classroom>>('/classrooms?limit=100'),
      ]);
      setStudents(studentResult.data);
      setClassrooms(classroomResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(offset: number) {
    try {
      const result = await apiRequest<ReportHistoryPage>(
        `/reports/history${buildQuery({ limit: HISTORY_PAGE_SIZE, offset })}`
      );
      setHistory(result.data);
      setHistoryHasMore(result.hasMore);
      setHistoryTotal(result.meta?.total ?? result.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the report history');
    }
  }

  async function download(key: string, path: string, filename: string) {
    setBusy(key);
    setError('');

    try {
      await downloadFile(path, filename);
      // Every export is recorded: show it in the history right away.
      if (historyOffset === 0) {
        await loadHistory(0);
      } else {
        setHistoryOffset(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download the report');
    } finally {
      setBusy('');
    }
  }

  function downloadPdf(student: Student) {
    void download(
      `pdf-${student.id}`,
      `/reports/students/${student.id}/academic-summary/pdf?year=${yearNumber}`,
      `academic-summary-${student.lastName}-${yearNumber}.pdf`
    );
  }

  function exportCsv() {
    void download(
      'csv',
      `/reports/export.csv${buildQuery({
        year: yearNumber,
        classroomId: exportClassroomId || undefined,
        studentId: exportStudentId || undefined,
      })}`,
      `grades-${yearNumber}.csv`
    );
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h1 className="page-title">Reports and exports</h1>
          <p className="body-copy">
            Download academic summaries, export grades as CSV and review every export.
          </p>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="grid grid-2">
        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Export</p>
              <h2 className="section-title">Grades as CSV</h2>
            </div>
          </div>
          <div className="form">
            <FormField
              label="School year"
              max="2100"
              min="2000"
              name="reportYear"
              onChange={(event) => setYear(event.target.value)}
              type="number"
              value={year}
            />
            <div className="form-field">
              <label htmlFor="exportClassroom">Classroom</label>
              <select id="exportClassroom" onChange={(event) => setExportClassroomId(event.target.value)} value={exportClassroomId}>
                <option value="">Whole school</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {formatClassroom(classroom)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="exportStudent">Student</label>
              <select id="exportStudent" onChange={(event) => setExportStudentId(event.target.value)} value={exportStudentId}>
                <option value="">Every student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.fullName}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={!validYear || busy !== ''} onClick={exportCsv}>
              {busy === 'csv' ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Academic summaries</p>
              <h2 className="section-title">
                {loading ? 'Loading' : `${students.length} students`} - {validYear ? yearNumber : 'pick a year'}
              </h2>
            </div>
          </div>
          {loading ? (
            <PanelState message="Loading students..." tone="loading" />
          ) : (
            <div className="activity-list">
              {students.map((student) => (
                <article className="module-row" key={student.id}>
                  <span className="activity-mark">{student.firstName.slice(0, 1)}</span>
                  <span>
                    <strong>{student.fullName}</strong>
                    <p className="field-help">{student.dateOfBirth ?? 'No birth date'}</p>
                  </span>
                  <Button
                    disabled={!validYear || busy !== ''}
                    onClick={() => downloadPdf(student)}
                    variant="secondary"
                  >
                    {busy === `pdf-${student.id}` ? 'Preparing...' : 'PDF'}
                  </Button>
                </article>
              ))}
              {students.length === 0 ? (
                <div className="empty-state body-copy">No students yet.</div>
              ) : null}
            </div>
          )}
        </Card>
      </section>

      <section className="card section-stack">
        <div className="panel-header">
          <div>
            <p className="eyebrow">History</p>
            <h2 className="section-title">
              {historyTotal} {historyTotal === 1 ? 'export' : 'exports'}
            </h2>
          </div>
        </div>
        <DataTable
          columns={[
            {
              key: 'when',
              header: 'When',
              render: (entry) => (entry.createdAt ? formatDate(entry.createdAt) : '-'),
            },
            { key: 'student', header: 'Student', render: (entry) => <strong>{entry.studentName}</strong> },
            {
              key: 'type',
              header: 'Report',
              render: (entry) => REPORT_TYPE_LABELS[entry.reportType] ?? entry.reportType,
            },
            { key: 'year', header: 'Year', align: 'right', render: (entry) => entry.year },
          ]}
          emptyMessage="No exports yet."
          getRowKey={(entry) => entry.id}
          rows={history}
        />
        <div className="button-row pager-row">
          <Button
            disabled={historyOffset === 0}
            onClick={() => setHistoryOffset(Math.max(0, historyOffset - HISTORY_PAGE_SIZE))}
            variant="secondary"
          >
            Newer
          </Button>
          <Button
            disabled={!historyHasMore}
            onClick={() => setHistoryOffset(historyOffset + HISTORY_PAGE_SIZE)}
            variant="secondary"
          >
            Older
          </Button>
        </div>
      </section>
    </AdminShell>
  );
}
