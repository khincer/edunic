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
interface NavItem {
  label: string;
  href: string;
  disabled?: boolean;
  group: 'Workspace' | 'Roadmap';
}
const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', group: 'Workspace' },
  { label: 'Institutions', href: '/admin/institutions', group: 'Workspace' },
  { label: 'Students', href: '/admin/students', disabled: true, group: 'Roadmap' },
  { label: 'Enrollments', href: '/admin/enrollments', disabled: true, group: 'Roadmap' },
  { label: 'Grades & attendance', href: '/admin/academic-records', disabled: true, group: 'Roadmap' },
  { label: 'Reports', href: '/admin/reports', disabled: true, group: 'Roadmap' },
  { label: 'Billing', href: '/admin/billing', disabled: true, group: 'Roadmap' },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSyncExternalStore(onSessionChange, getSession, () => null);
  const ready = useSyncExternalStore(subscribeToHydration, getHydrated, getServerHydrated);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (ready && !session) {
      router.replace('/admin/login');
    }
  }, [ready, router, session]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/admin/institutions?search=${encodeURIComponent(value)}` : '/admin/institutions');
  }

  function handleLogout() {
    clearSession();
    router.replace('/admin/login');
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

  const pageLabel = getPageLabel(pathname);
  const groupedNavItems = navItems.reduce<Record<NavItem['group'], NavItem[]>>(
    (groups, item) => {
      groups[item.group].push(item);
      return groups;
    },
    { Workspace: [], Roadmap: [] }
  );

  return (
    <main className="admin-app">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="admin-brand" href="/admin/dashboard">
            <span className="admin-brand-mark">E</span>
            <span>
              <strong className="admin-brand-title">Edunic Admin</strong>
              <span className="admin-brand-subtitle">Institution console</span>
            </span>
          </Link>
          <nav aria-label="Admin navigation" className="admin-nav">
            {Object.entries(groupedNavItems).map(([group, items]) => (
              <div className="admin-nav-group" key={group}>
                <p>{group}</p>
                {items.map((item) =>
                  item.disabled ? (
                    <span className="admin-nav-disabled" key={item.label}>
                      <span className="admin-nav-icon" aria-hidden="true">
                        {item.label.slice(0, 1)}
                      </span>
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
                      <span className="admin-nav-icon" aria-hidden="true">
                        {item.label.slice(0, 1)}
                      </span>
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </nav>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar">
            <div className="admin-page-trail" aria-label="Current section">
              <span>Admin</span>
              <strong>{pageLabel}</strong>
            </div>
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
                {session.user.role} - local API
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

function getPageLabel(pathname: string) {
  if (pathname.startsWith('/admin/institutions/new')) {
    return 'New institution';
  }

  if (pathname.startsWith('/admin/institutions')) {
    return 'Institutions';
  }

  return 'Dashboard';
}
