'use client';

import { AdminShell } from '@/components/admin-shell';
import { ButtonLink } from '@/components/button';
import { Card } from '@/components/card';

export default function NewInstitutionPage() {
  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">New institution</p>
          <h1 className="page-title">Platform admin required</h1>
          <p className="body-copy">
            Tenant admins can manage only their current school. Creating schools belongs in a
            separate platform administration console.
          </p>
        </div>
        <ButtonLink href="/admin/institutions" variant="secondary">
          Back to institution
        </ButtonLink>
      </header>

      <Card>
        <div className="alert alert-info">
          Institution creation is disabled from tenant domains.
        </div>
      </Card>
    </AdminShell>
  );
}
