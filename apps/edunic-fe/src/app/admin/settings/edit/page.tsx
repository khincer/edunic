'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useSchool } from '@/lib/school';
import { Button, ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function EditInstitutionPage() {
  const router = useRouter();
  const { school } = useSchool();
  const institutionId = school?.id ?? '';
  // SI-R2: the API scopes PATCH to the caller's own institution (P2 added the
  // guard), so this page is only usable for that one. For any other school we
  // show what the read API returned and no form, instead of a form whose save
  // would always fail with 403.
  const [name, setName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadInstitution() {
      if (!institutionId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<ApiSingleResponse<Institution>>(
          `/institutions/${institutionId}`
        );
        setName(result.data.name);
        setSenderName(result.data.senderName ?? '');
        setReplyToEmail(result.data.replyToEmail ?? '');
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
        body: { name, senderName, replyToEmail },
      });
      router.push(`/admin/settings`);
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
          <p className="eyebrow">Institution settings</p>
          <h1 className="page-title">Edit institution</h1>
          <p className="body-copy">
            Keep the school record recognizable and set the sender identity used
            on the emails this school sends to families.
          </p>
        </div>
        <ButtonLink href={`/admin/settings`} variant="secondary">
          Back to detail
        </ButtonLink>
      </header>

      <Card>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? <p className="body-copy">Loading school...</p> : null}
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
            <FormField
              help="Display name shown to families as the sender. Leave empty and no email is sent."
              label="Sender name"
              maxLength={120}
              name="senderName"
              onChange={(event) => setSenderName(event.target.value)}
              value={senderName}
            />
            <FormField
              help="Where families reply. Left empty, the platform reply-to address is used."
              label="Reply-to email"
              maxLength={160}
              name="replyToEmail"
              onChange={(event) => setReplyToEmail(event.target.value)}
              type="email"
              value={replyToEmail}
            />
            <div className="button-row">
              <Button disabled={busy} type="submit">
                {busy ? 'Saving...' : 'Save changes'}
              </Button>
              <ButtonLink href={`/admin/settings`} variant="secondary">
                Cancel
              </ButtonLink>
            </div>
          </form>
        ) : null}
      </Card>
    </AdminShell>
  );
}
