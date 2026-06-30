'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  formatDate,
  type ApiListResponse,
  type Institution,
} from '@/lib/api';

export default function DashboardPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<ApiListResponse<Institution>>(
          '/institutions?limit=5&offset=0&sortBy=createdAt&sortOrder=desc'
        );
        setInstitutions(result.data);
        setTotal(result.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Platform overview</p>
          <h1 className="page-title">Institution command center</h1>
          <p className="body-copy">
            Manage schools, review operational readiness, and open institution-scoped tools from one quiet surface.
          </p>
        </div>
        <ButtonLink href="/admin/institutions/new">New institution</ButtonLink>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="dashboard-stat-grid">
        <Card className="dashboard-stat-card">
          <p className="eyebrow">Institutions</p>
          <p className="metric">{loading ? '...' : total}</p>
          <p className="body-copy">schools available to this admin console</p>
        </Card>
        <Card className="dashboard-stat-card">
          <p className="eyebrow">Core records</p>
          <p className="metric">MVP</p>
          <p className="body-copy">students, enrollments, grades, attendance, and periods remain the delivery focus</p>
        </Card>
        <Card className="dashboard-stat-card" tone="dark">
          <p className="eyebrow">Access model</p>
          <p className="metric">3</p>
          <p className="body-copy muted-on-dark">
            admin, teacher, and parent workspaces stay separated by role and institution
          </p>
        </Card>
      </section>

      <section className="dashboard-workspace-grid">
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recent institutions</p>
              <h2 className="section-title">Newest schools</h2>
            </div>
            <ButtonLink href="/admin/institutions" variant="secondary">
              View all
            </ButtonLink>
          </div>
          {loading ? <p className="body-copy">Loading institutions...</p> : null}
          {!loading && institutions.length === 0 ? (
            <div className="empty-state body-copy">No institutions yet.</div>
          ) : null}
          <div className="institution-list">
            {institutions.map((institution) => (
              <a className="institution-row" href={`/admin/institutions/${institution.id}`} key={institution.id}>
                <span className="institution-row-mark" aria-hidden="true">
                  {institution.name.slice(0, 1)}
                </span>
                <span>
                  <strong>{institution.name}</strong>
                  <p className="field-help">Created {formatDate(institution.createdAt)}</p>
                </span>
                <span className="badge badge-blue">Open</span>
              </a>
            ))}
          </div>
        </Card>
        <Card className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Roadmap flow</p>
              <h2 className="section-title">Operational sequence</h2>
            </div>
          </div>
          <div className="roadmap-flow" aria-label="Roadmap modules">
            {['Students', 'Enrollments', 'Academic periods', 'Grades', 'Attendance', 'Reports'].map((item, index) => (
              <div className="roadmap-step" key={item}>
                <span>{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
          <div className="panel-action-row">
            <ButtonLink href="/admin/institutions/new">Create school</ButtonLink>
            <ButtonLink href="/admin/institutions" variant="secondary">
              Search schools
            </ButtonLink>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
