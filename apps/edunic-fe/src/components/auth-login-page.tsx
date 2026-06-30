'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { clearSession, getSession, login } from '@/lib/auth';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuthShortcut = {
  label: string;
  email: string;
  password: string;
  institutionId: string;
};

type AuthLoginPageProps = {
  accent: 'admin' | 'teacher' | 'parent';
  activeLabel: string;
  allowedRoles: string[];
  brandSubtitle: string;
  brandTitle: string;
  capabilities: string[];
  emailPlaceholder: string;
  eyebrow: string;
  heroEyebrow: string;
  heroText: string;
  heroTitle: string;
  intro: string;
  redirectTo: string;
  requiredRoleLabel: string;
  sectionLabel: string;
  shortcuts: AuthShortcut[];
  signupText: string;
  signupTitle: string;
  title: string;
};

export function AuthLoginPage({
  accent,
  activeLabel,
  allowedRoles,
  brandSubtitle,
  brandTitle,
  capabilities,
  emailPlaceholder,
  eyebrow,
  heroEyebrow,
  heroText,
  heroTitle,
  intro,
  redirectTo,
  requiredRoleLabel,
  sectionLabel,
  shortcuts,
  signupText,
  signupTitle,
  title,
}: AuthLoginPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const selectedInstitution =
    shortcuts.find((account) => account.institutionId === institutionId.trim()) ??
    shortcuts.find((account) => account.email === email.trim().toLowerCase()) ??
    null;

  useEffect(() => {
    const session = getSession();
    if (session && allowedRoles.includes(session.user.role)) {
      router.replace(redirectTo);
    }
  }, [allowedRoles, redirectTo, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!UUID_PATTERN.test(institutionId.trim())) {
      setError('Institution ID must be a UUID. Use a seeded shortcut or paste the institution UUID.');
      return;
    }

    setBusy(true);

    try {
      const session = await login({
        email,
        password,
        institutionId: institutionId.trim(),
      });

      if (!allowedRoles.includes(session.user.role)) {
        clearSession();
        setError(`This login is for ${requiredRoleLabel}. Your account is marked as ${session.user.role}.`);
        return;
      }

      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`login-page auth-${accent}`}>
      <section aria-label={`${sectionLabel} sign in`} className="login-panel">
        <div className="auth-brand">
          <span className="auth-brand-mark">E</span>
          <span>
            <strong>{brandTitle}</strong>
            <small>{brandSubtitle}</small>
          </span>
        </div>

        <section className="login-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="section-title">{title}</h1>
          <p className="body-copy">{intro}</p>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field" htmlFor="email">
              <span>Email address</span>
              <span className="auth-input-wrap">
                <span aria-hidden="true" className="auth-input-icon">@</span>
                <input
                  autoComplete="email"
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={emailPlaceholder}
                  required
                  type="email"
                  value={email}
                />
              </span>
            </label>

            <label className="auth-field" htmlFor="password">
              <span>Password</span>
              <span className="auth-input-wrap">
                <span aria-hidden="true" className="auth-input-icon">**</span>
                <input
                  autoComplete="current-password"
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="auth-visibility"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            <label className="auth-field" htmlFor="institutionId">
              <span>Institution UUID</span>
              <span className="auth-input-wrap">
                <span aria-hidden="true" className="auth-input-icon">ID</span>
                <input
                  autoComplete="organization"
                  id="institutionId"
                  name="institutionId"
                  onChange={(event) => setInstitutionId(event.target.value)}
                  placeholder="Paste institution UUID"
                  required
                  type="text"
                  value={institutionId}
                />
              </span>
            </label>

            <Button className="auth-submit" disabled={busy} type="submit">
              {busy ? 'Signing in...' : 'Sign in'}
              <span aria-hidden="true">-&gt;</span>
            </Button>
          </form>

          {shortcuts.length > 0 ? (
            <div className="institution-shortcuts" aria-label="Seeded account shortcuts">
              <div className="auth-divider">
                <span>Seeded access</span>
              </div>
              <div className="institution-option-grid">
                {shortcuts.map((account) => (
                  <button
                    className="institution-option"
                    data-active={institutionId === account.institutionId && email === account.email}
                    key={`${account.label}-${account.email}`}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setInstitutionId(account.institutionId);
                      setError('');
                    }}
                    type="button"
                  >
                    <strong>{account.label}</strong>
                    <span>{account.email}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="auth-signup-note">
            <span>{signupTitle}</span>
            <span>{signupText}</span>
          </div>
        </section>
      </section>

      <section aria-label={`${sectionLabel} context`} className="login-hero">
        <div className="auth-image-layer" aria-hidden="true" />
        <div className="auth-hero-copy">
          <p className="eyebrow">{heroEyebrow}</p>
          <h2>{heroTitle}</h2>
          <p>{heroText}</p>
        </div>

        <div className="institution-brief">
          <div className="institution-brief-header">
            <span className="institution-badge">{activeLabel}</span>
            <span className="institution-status">{requiredRoleLabel}</span>
          </div>
          <h3>{selectedInstitution?.label ?? 'Choose a seeded account'}</h3>
          <p>{selectedInstitution?.email ?? 'Select a shortcut or paste an institution UUID.'}</p>
          <dl>
            <div>
              <dt>Institution ID</dt>
              <dd>{selectedInstitution?.institutionId ?? 'Waiting for UUID'}</dd>
            </div>
            <div>
              <dt>Required login data</dt>
              <dd>Email, password, institution UUID</dd>
            </div>
          </dl>
        </div>

        <div className="auth-capability-grid" aria-label={`${sectionLabel} capabilities`}>
          {capabilities.map((capability) => (
            <span key={capability}>{capability}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
