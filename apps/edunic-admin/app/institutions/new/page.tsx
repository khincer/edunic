'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function NewInstitutionPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      const result = await apiRequest<ApiSingleResponse<Institution>>('/institutions', {
        method: 'POST',
        body: { name },
      });
      router.push(`/institutions/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create institution');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">New institution</p>
          <h1 className="page-title">Create a school</h1>
          <p className="body-copy">
            The current backend only requires an institution name. Operational settings can be attached after creation.
          </p>
        </div>
        <ButtonLink href="/institutions" variant="secondary">
          Back to institutions
        </ButtonLink>
      </header>

      <Card>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form className="form" onSubmit={handleSubmit}>
          <FormField
            autoFocus
            help="Use the public school name admins will recognize."
            label="Institution name"
            maxLength={160}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <div className="button-row">
            <Button disabled={busy} type="submit">
              {busy ? 'Creating...' : 'Create institution'}
            </Button>
            <ButtonLink href="/institutions" variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </AdminShell>
  );
}
