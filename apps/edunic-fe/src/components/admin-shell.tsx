'use client';

import {
  Activity,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Wallet,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useSyncExternalStore } from 'react';
import {
  clearSession,
  getSession,
  onSessionChange,
} from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import { Button, ButtonLink } from './button';

type AdminShellProps = {
  children: ReactNode;
};
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      { label: 'Students', href: '/admin/students', icon: UsersRound },
      { label: 'Teachers', href: '/admin/teachers', icon: GraduationCap },
      { label: 'Enrollments', href: '/admin/enrollments', icon: ClipboardList },
    ],
  },
  {
    label: 'Academics',
    items: [
      { label: 'Subjects', href: '/admin/subjects', icon: Library },
      { label: 'Academic periods', href: '/admin/academic-periods', icon: CalendarDays },
      { label: 'Grades', href: '/admin/grades', icon: BookOpenCheck },
      { label: 'Attendance', href: '/admin/attendance', icon: ClipboardCheck },
      { label: 'Reports', href: '/admin/reports', icon: FileText },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Classroom activity', href: '/admin/activity', icon: Activity },
      { label: 'Workflows', href: '/admin/workflows', icon: Workflow },
      { label: 'Payments', href: '/admin/payments', icon: Wallet },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell },
      { label: 'School settings', href: '/admin/settings', icon: Building2 },
    ],
  },
];

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSyncExternalStore(onSessionChange, getSession, () => null);
  const ready = useSyncExternalStore(subscribeToHydration, getHydrated, getServerHydrated);

  useEffect(() => {
    if (ready && !session) {
      router.replace('/admin/login');
    }
  }, [ready, router, session]);

  function handleLogout() {
    clearSession();
    router.replace('/admin/login');
  }

  if (!ready || !session) {
    return (
      <main className="admin-app">
        <div className="admin-content">
          <section className="empty-state body-copy">Checking your session…</section>
        </div>
      </main>
    );
  }

  // ROLE-01: the console belongs to the school administration. A signed-in
  // teacher or parent is pointed at their own portal instead (the API refuses
  // them the console data anyway).
  if (!isAdminRole(session.user.role)) {
    const portal = getPortalFor(session.user.role);

    return (
      <main className="admin-app">
        <div className="admin-content">
          <section className="card section-stack" role="alert">
            <h1 className="page-title">This console is for the school administration</h1>
            <p className="body-copy">
              You are signed in as {session.user.email} ({session.user.role}).
            </p>
            <div className="button-row">
              {portal ? (
                <ButtonLink href={portal.href}>{portal.label}</ButtonLink>
              ) : null}
              <Button onClick={handleLogout} variant="secondary">
                Sign out
              </Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="admin-brand" href="/admin/dashboard">
            <span className="admin-brand-mark">E</span>
            <span>
              <strong className="admin-brand-title">Edunic</strong>
              <span className="admin-brand-subtitle">Administration</span>
            </span>
          </Link>
          <nav aria-label="Admin navigation" className="admin-nav">
            {navGroups.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className="admin-nav-link"
                      data-active={active}
                      href={item.href}
                      key={item.href}
                    >
                      <span className="admin-nav-icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={2} />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <span className="admin-sidebar-user">
              <strong>{session.user.email}</strong>
              <span>{formatRole(session.user.role)}</span>
            </span>
            <Button
              aria-label="Sign out"
              className="button-small"
              onClick={handleLogout}
              title="Sign out"
              variant="ghost"
            >
              <LogOut aria-hidden="true" size={16} strokeWidth={2} />
            </Button>
          </div>
        </aside>
        <section className="admin-main">
          <div className="admin-content">{children}</div>
        </section>
      </div>
    </main>
  );
}

function getPortalFor(role: string) {
  if (role === 'teacher') {
    return { href: '/teachers', label: 'Go to the teacher portal' };
  }

  if (role === 'parent') {
    return { href: '/parents', label: 'Go to the parent portal' };
  }

  return null;
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

function formatRole(role: string) {
  return role.replace(/_/g, ' ');
}
