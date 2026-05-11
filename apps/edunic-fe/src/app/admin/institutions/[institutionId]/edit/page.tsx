'use client';

import { useParams, useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function EditInstitutionPage() {
  const params = useParams<{ institutionId: string }>();
  const router = useRouter();
  const institutionId = params.institutionId;
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadInstitution() {
      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<ApiSingleResponse<Institution>>(
          `/institutions/${institutionId}`
        );
        setName(result.data.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load institution');
      } finally {
        setLoading(false);
      }
    }

    void loadInstitution();
  }, [institutionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await apiRequest<ApiSingleResponse<Institution>>(`/institutions/${institutionId}`, {
        method: 'PATCH',
        body: { name },
      });
      router.push(`/admin/institutions/${institutionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update institution');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Rename institution</p>
          <h1 className="page-title">Edit school name</h1>
          <p className="body-copy">Keep the school record recognizable for platform operators.</p>
        </div>
        <ButtonLink href={`/admin/institutions/${institutionId}`} variant="secondary">
          Back to detail
        </ButtonLink>
      </header>

      <Card>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? <p className="body-copy">Loading institution...</p> : null}
        {!loading ? (
          <form className="form" onSubmit={handleSubmit}>
            <FormField
              autoFocus
              label="Institution name"
              maxLength={160}
              name="name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <div className="button-row">
              <Button disabled={busy} type="submit">
                {busy ? 'Saving...' : 'Save changes'}
              </Button>
              <ButtonLink href={`/admin/institutions/${institutionId}`} variant="secondary">
                Cancel
              </ButtonLink>
            </div>
          </form>
        ) : null}
      </Card>
    </AdminShell>
  );
}
