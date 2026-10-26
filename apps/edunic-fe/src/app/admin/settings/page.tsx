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
  const schoolId = school?.id ?? '';
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInstitution() {
      if (!schoolId) {
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
  }, [schoolId]);

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">School settings</p>
          <h1 className="page-title">
            {institution?.name ?? (loading ? 'Loading school…' : 'School')}
          </h1>
        </div>
        <div className="button-row">
          <ButtonLink href="/admin/settings/edit" variant="secondary">
            Edit
          </ButtonLink>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {institution ? (
        <section className="grid grid-2">
          <Card>
            <h2 className="section-title">Details</h2>
            <div className="timeline-list section-stack">
              <div className="timeline-row">
                <span>Name</span>
                <strong>{institution.name}</strong>
              </div>
              <div className="timeline-row">
                <span>Sender name</span>
                <strong>{institution.senderName || 'Not set'}</strong>
              </div>
              <div className="timeline-row">
                <span>Reply-to email</span>
                <strong className="break-value">{institution.replyToEmail || 'Not set'}</strong>
              </div>
              <div className="timeline-row">
                <span>Created</span>
                <strong>{formatDate(institution.createdAt)}</strong>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="section-title">Configuration</h2>
            <p className="body-copy">
              Extensions, feature flags and the audit log for this school.
            </p>
            <div className="button-row">
              <ButtonLink href="/admin/settings/extensions" variant="secondary">
                Extensions
              </ButtonLink>
              <ButtonLink href="/admin/settings/feature-flags" variant="secondary">
                Feature flags
              </ButtonLink>
              <ButtonLink href="/admin/settings/audit-logs" variant="secondary">
                Audit log
              </ButtonLink>
            </div>
          </Card>
        </section>
      ) : null}

    </AdminShell>
  );
}
