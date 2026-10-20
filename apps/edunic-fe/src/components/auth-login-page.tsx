'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { clearSession, getSession, login } from '@/lib/auth';

export type AuthLoginPageProps = {
  accent: 'admin' | 'teacher' | 'parent';
  allowedRoles: string[];
  brandSubtitle: string;
  brandTitle: string;
  emailPlaceholder: string;
  eyebrow: string;
  heroText: string;
  intro: string;
  redirectTo: string;
  requiredRoleLabel: string;
  sectionLabel: string;
  title: string;
};

export function AuthLoginPage({
  accent,
  allowedRoles,
  brandSubtitle,
  brandTitle,
  emailPlaceholder,
  eyebrow,
  heroText,
  intro,
  redirectTo,
  requiredRoleLabel,
  sectionLabel,
  title,
}: AuthLoginPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = Boolean(email.trim() && password);

  useEffect(() => {
    const session = getSession();
    if (session && allowedRoles.includes(session.user.role)) {
      router.replace(redirectTo);
    }
  }, [allowedRoles, redirectTo, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    setBusy(true);

    try {
      const session = await login({
        email,
        password,
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

            <Button className="auth-submit" disabled={busy || !canSubmit} type="submit">
              {busy ? 'Signing in...' : 'Sign in'}
              <span aria-hidden="true">-&gt;</span>
            </Button>
          </form>
        </section>
      </section>

      <section aria-label={`${sectionLabel} context`} className="login-hero">
        <div className="auth-image-layer" aria-hidden="true" />
        <div className="school-identity">
          <span className="school-badge">ED</span>
          <h2>Your school, in one place</h2>
          <p>{heroText}</p>
        </div>
      </section>
    </main>
  );
}
