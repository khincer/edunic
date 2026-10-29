'use client';

import { Lock, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { clearSession, getSession, login } from '@/lib/auth';
import { formatRole } from '@/lib/roles';

export type AuthLoginPageProps = {
  accent: 'admin' | 'teacher' | 'parent';
  allowedRoles: string[];
  brandSubtitle: string;
  brandTitle: string;
  emailPlaceholder: string;
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
        setError(`Este inicio de sesión es para ${requiredRoleLabel}. Su cuenta está marcada como ${formatRole(session.user.role)}.`);
        return;
      }

      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`login-page auth-${accent}`}>
      <section aria-label={`Inicio de sesión: ${sectionLabel}`} className="login-panel">
        <div className="auth-brand">
          <span className="auth-brand-mark">E</span>
          <span>
            <strong>{brandTitle}</strong>
            <small>{brandSubtitle}</small>
          </span>
        </div>

        <section className="login-card">
          <h1 className="section-title">{title}</h1>
          <p className="body-copy">{intro}</p>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field" htmlFor="email">
              <span>Correo electrónico</span>
              <span className="auth-input-wrap">
                <span aria-hidden="true" className="auth-input-icon">
                  <Mail size={16} strokeWidth={2} />
                </span>
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
              <span>Contraseña</span>
              <span className="auth-input-wrap">
                <span aria-hidden="true" className="auth-input-icon">
                  <Lock size={16} strokeWidth={2} />
                </span>
                <input
                  autoComplete="current-password"
                  id="password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="auth-visibility"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>

            <Button className="auth-submit" disabled={busy || !canSubmit} type="submit">
              {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </Button>
          </form>
        </section>
      </section>

      <section aria-label={`Contexto: ${sectionLabel}`} className="login-hero">
        <div className="school-identity">
          <h2>{brandTitle}</h2>
          <p>{heroText}</p>
        </div>
      </section>
    </main>
  );
}
