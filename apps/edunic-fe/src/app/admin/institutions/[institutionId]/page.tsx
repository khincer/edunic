'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  formatDate,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function InstitutionDetailPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstitution() {
      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<ApiSingleResponse<Institution>>(
          `/institutions/${institutionId}`
        );
        setInstitution(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load institution');
      } finally {
        setLoading(false);
      }
    }

    void loadInstitution();
  }, [institutionId]);

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Institution detail</p>
          <h1 className="page-title">
            {institution?.name ?? (loading ? 'Loading school' : 'Institution')}
          </h1>
          <p className="body-copy">
            Inspect the institution record and open scoped operations.
          </p>
        </div>
        <div className="button-row">
          <ButtonLink href={`/admin/institutions/${institutionId}/edit`} variant="secondary">
            Rename
          </ButtonLink>
          <ButtonLink href="/admin/institutions" variant="secondary">
            Back
          </ButtonLink>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Loading institution...</div> : null}

      {institution ? (
        <>
          <section className="grid grid-3">
            <Card>
              <p className="eyebrow">Record</p>
              <p className="metric">Active</p>
              <p className="body-copy">available for scoped operations</p>
            </Card>
            <Card>
              <p className="eyebrow">Created</p>
              <p className="metric metric-compact">
                {formatDate(institution.createdAt)}
              </p>
              <p className="body-copy">institution onboarding timestamp</p>
            </Card>
            <Card tone="soft">
              <p className="eyebrow">Identifier</p>
              <p className="body-copy break-value">
                {institution.id}
              </p>
            </Card>
          </section>

          <section className="section-stack">
            <Card>
              <p className="eyebrow">Operations</p>
              <h2 className="section-title">Manage this school</h2>
              <p className="body-copy">
                Extension toggles and audit trails use this institution id for tenant-scoped API calls.
              </p>
              <div className="button-row">
                <ButtonLink href={`/admin/institutions/${institution.id}/extensions`}>
                  Extensions
                </ButtonLink>
                <ButtonLink href={`/admin/institutions/${institution.id}/feature-flags`} variant="secondary">
                  Feature flags
                </ButtonLink>
                <ButtonLink href={`/admin/institutions/${institution.id}/audit-logs`} variant="secondary">
                  Audit logs
                </ButtonLink>
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
