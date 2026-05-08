'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { getSession, login } from '@/lib/auth';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const seedAccounts = [
  {
    label: 'Central admin',
    email: 'admin@central.edu',
    password: 'admin1234',
    institutionId: '00000000-0000-0000-0000-000000000001',
  },
  {
    label: 'North admin',
    email: 'admin@north.edu',
    password: 'admin1234',
    institutionId: '00000000-0000-0000-0000-000000000002',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (getSession()) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!UUID_PATTERN.test(institutionId.trim())) {
      setError('Institution ID must be a UUID. Use one of the seeded admin shortcuts or paste the institution UUID.');
      return;
    }

    setBusy(true);

    try {
      await login({
        email,
        password,
        institutionId: institutionId.trim(),
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div>
          <p className="eyebrow">Edunic platform</p>
          <h1 className="page-title" style={{ color: 'white', maxWidth: 700 }}>
            A calm command center for every school you operate.
          </h1>
          <p className="body-copy" style={{ color: 'var(--color-on-dark-soft, #a8acb3)', maxWidth: 560 }}>
            Manage institutions, extensions, audit trails, and operational readiness from one trusted surface.
          </p>
        </div>
        <div className="mock-stack" aria-hidden="true">
          <div className="mock-panel">
            <span className="badge badge-blue">42 institutions</span>
            <p className="metric">98.4%</p>
            <p className="body-copy" style={{ color: '#a8acb3' }}>
              active academic operations
            </p>
          </div>
          <div className="mock-panel" style={{ transform: 'translateX(32px)' }}>
            <span className="badge">Extensions ready</span>
            <p className="body-copy" style={{ color: '#a8acb3' }}>
              Notifications, reports, custom fields, and audit coverage stay institution-scoped.
            </p>
          </div>
        </div>
      </section>
      <section className="login-card">
        <p className="eyebrow">Admin access</p>
        <h2 className="section-title">Sign in</h2>
        <p className="body-copy">
          Use the institution id tied to your admin role. The API returns the token used for this v1 console session.
        </p>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <form className="form" onSubmit={handleSubmit}>
          <FormField
            autoComplete="email"
            label="Email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <FormField
            autoComplete="current-password"
            label="Password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <FormField
            help="Must be a UUID. Seeded Central: 00000000-0000-0000-0000-000000000001."
            label="Institution ID"
            name="institutionId"
            onChange={(event) => setInstitutionId(event.target.value)}
            placeholder="00000000-0000-0000-0000-000000000001"
            required
            type="text"
            value={institutionId}
          />
          <div className="grid grid-2">
            {seedAccounts.map((account) => (
              <button
                className="card card-soft"
                key={account.label}
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setInstitutionId(account.institutionId);
                  setError('');
                }}
                type="button"
              >
                <span className="badge badge-blue">{account.label}</span>
                <p className="body-copy" style={{ marginBottom: 0, textAlign: 'left' }}>
                  {account.email}
                </p>
              </button>
            ))}
          </div>
          <Button disabled={busy} type="submit">
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </section>
    </main>
  );
}
