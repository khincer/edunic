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

      <section className="grid grid-3">
        <Card>
          <p className="eyebrow">Institutions</p>
          <p className="metric">{loading ? '...' : total}</p>
          <p className="body-copy">schools available to this admin console</p>
        </Card>
        <Card>
          <p className="eyebrow">Primary workflow</p>
          <p className="metric">CRUD</p>
          <p className="body-copy">create, rename, inspect, and retire institutions</p>
        </Card>
        <Card tone="dark">
          <p className="eyebrow">Roadmap</p>
          <p className="metric">v1</p>
          <p className="body-copy" style={{ color: '#a8acb3' }}>
            billing and usage analytics stay disabled until registered API routes exist
          </p>
        </Card>
      </section>

      <section className="grid grid-2" style={{ marginTop: 24 }}>
        <Card>
          <div className="page-header" style={{ marginBottom: 18 }}>
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
          <div className="grid">
            {institutions.map((institution) => (
              <a className="card card-soft" href={`/admin/institutions/${institution.id}`} key={institution.id}>
                <strong>{institution.name}</strong>
                <p className="field-help">Created {formatDate(institution.createdAt)}</p>
              </a>
            ))}
          </div>
        </Card>
        <Card>
          <p className="eyebrow">Quick actions</p>
          <h2 className="section-title">Institution operations</h2>
          <p className="body-copy">
            Start with the institution record, then open extension and audit-log tools from the institution detail view.
          </p>
          <div className="button-row">
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
