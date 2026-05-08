'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  apiRequest,
  formatDate,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function InstitutionDetailPage() {
  const params = useParams<{ institutionId: string }>();
  const router = useRouter();
  const institutionId = params.institutionId;
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function handleDelete() {
    setBusy(true);
    setDeleteError('');

    try {
      await apiRequest<ApiSingleResponse<{ id: string; deleted: boolean }>>(
        `/institutions/${institutionId}`,
        { method: 'DELETE' }
      );
      router.push('/institutions');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete institution');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

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
          <ButtonLink href={`/institutions/${institutionId}/edit`} variant="secondary">
            Rename
          </ButtonLink>
          <ButtonLink href="/institutions" variant="secondary">
            Back
          </ButtonLink>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {deleteError ? <div className="alert alert-error">{deleteError}</div> : null}
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
              <p className="metric" style={{ fontSize: 22 }}>
                {formatDate(institution.createdAt)}
              </p>
              <p className="body-copy">institution onboarding timestamp</p>
            </Card>
            <Card tone="soft">
              <p className="eyebrow">Identifier</p>
              <p className="body-copy" style={{ wordBreak: 'break-all' }}>
                {institution.id}
              </p>
            </Card>
          </section>

          <section className="grid grid-2" style={{ marginTop: 24 }}>
            <Card>
              <p className="eyebrow">Operations</p>
              <h2 className="section-title">Manage this school</h2>
              <p className="body-copy">
                Extension toggles and audit trails use this institution id for tenant-scoped API calls.
              </p>
              <div className="button-row">
                <ButtonLink href={`/institutions/${institution.id}/extensions`}>
                  Extensions
                </ButtonLink>
                <ButtonLink href={`/institutions/${institution.id}/audit-logs`} variant="secondary">
                  Audit logs
                </ButtonLink>
              </div>
            </Card>
            <Card>
              <p className="eyebrow">Danger zone</p>
              <h2 className="section-title">Delete institution</h2>
              <p className="body-copy">
                The API blocks deletion when academic records depend on this school.
              </p>
              <Button onClick={() => setConfirmOpen(true)} variant="danger">
                Delete institution
              </Button>
            </Card>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        body="This removes the institution record only if no students, classrooms, or enrollments depend on it."
        busy={busy}
        confirmLabel="Delete institution"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        open={confirmOpen}
        title={`Delete ${institution?.name ?? 'institution'}?`}
      />
    </AdminShell>
  );
}
