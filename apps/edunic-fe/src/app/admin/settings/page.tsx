'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useSchool } from '@/lib/school';
import { ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  formatDate,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function SchoolSettingsPage() {
  const { school } = useSchool();
  const institutionId = school?.id ?? '';
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstitution() {
      if (!institutionId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<ApiSingleResponse<Institution>>(
          `/school-profile`
        );
        setInstitution(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the school');
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
          <p className="eyebrow">School settings</p>
          <h1 className="page-title">
            {institution?.name ?? (loading ? 'Loading school' : 'School')}
          </h1>
          <p className="body-copy">
            Inspect the school record and open scoped operations.
          </p>
        </div>
        <div className="button-row">
          <ButtonLink href="/admin/settings/edit" variant="secondary">
            Edit
          </ButtonLink>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Loading school...</div> : null}

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
              <p className="body-copy">school onboarding timestamp</p>
            </Card>
            <Card tone="soft">
              <p className="eyebrow">Identifier</p>
              <p className="body-copy break-value">
                {institution.id}
              </p>
            </Card>
          </section>

          <section className="grid grid-2 section-stack">
            <Card>
              <p className="eyebrow">Operations</p>
              <h2 className="section-title">Manage this school</h2>
              <p className="body-copy">
                Extension toggles, feature flags and audit trails for this school.
              </p>
              <div className="button-row">
                <ButtonLink href="/admin/settings/extensions">
                  Extensions
                </ButtonLink>
                <ButtonLink href="/admin/settings/feature-flags" variant="secondary">
                  Feature flags
                </ButtonLink>
                <ButtonLink href="/admin/settings/audit-logs" variant="secondary">
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
