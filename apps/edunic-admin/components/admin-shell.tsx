'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  clearSession,
  getSession,
  onSessionChange,
} from '@/lib/auth';
import { Button } from './button';

type AdminShellProps = {
  children: ReactNode;
};

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Institutions', href: '/institutions' },
  { label: 'Extensions', href: '/institutions', badge: 'per school' },
  { label: 'Audit Logs', href: '/institutions', badge: 'per school' },
  { label: 'Settings', href: '/settings', disabled: true },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSyncExternalStore(onSessionChange, getSession, () => null);
  const ready = useSyncExternalStore(subscribeToHydration, getHydrated, getServerHydrated);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (ready && !session) {
      router.replace('/login');
    }
  }, [ready, router, session]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/institutions?search=${encodeURIComponent(value)}` : '/institutions');
  }

  function handleLogout() {
    clearSession();
    router.replace('/login');
  }

  if (!ready || !session) {
    return (
      <main className="admin-app">
        <div className="admin-content">
          <section className="empty-state body-copy">Checking admin session...</section>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="admin-brand" href="/dashboard">
            <span className="admin-brand-mark">E</span>
            <span>
              <strong className="admin-brand-title">Edunic Admin</strong>
              <span className="admin-brand-subtitle">Institution console</span>
            </span>
          </Link>
          <nav aria-label="Admin navigation" className="admin-nav">
            {navItems.map((item) =>
              item.disabled ? (
                <span className="admin-nav-disabled" key={item.label}>
                  {item.label}
                  <span className="admin-nav-pill">soon</span>
                </span>
              ) : (
                <Link
                  className="admin-nav-link"
                  data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                  {item.badge ? <span className="admin-nav-pill">{item.badge}</span> : null}
                </Link>
              )
            )}
          </nav>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar">
            <form className="admin-search" onSubmit={handleSearch}>
              <input
                aria-label="Search institutions"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search institutions"
                value={search}
              />
              <button type="submit">Search</button>
            </form>
            <div className="admin-user">
              <span>
                <strong>{session.user.email}</strong>
                {session.user.role} · local API
              </span>
              <Button onClick={handleLogout} variant="secondary">
                Sign out
              </Button>
            </div>
          </header>
          <div className="admin-content">{children}</div>
        </section>
      </div>
    </main>
  );
}

function subscribeToHydration() {
  return () => undefined;
}

function getHydrated() {
  return true;
}

function getServerHydrated() {
  return false;
}
