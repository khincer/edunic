'use client';

import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
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
import { Button } from './button';

type AdminShellProps = {
  children: ReactNode;
};
interface NavItem {
  label: string;
  href: string;
  group: 'Workspace' | 'Roadmap';
  icon: LucideIcon;
}
const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', group: 'Workspace', icon: LayoutDashboard },
  { label: 'School', href: '/admin/settings', group: 'Workspace', icon: Building2 },
  { label: 'Notifications', href: '/admin/notifications', group: 'Workspace', icon: Bell },
  { label: 'Students', href: '/admin/students', group: 'Roadmap', icon: UsersRound },
  { label: 'Enrollments', href: '/admin/enrollments', group: 'Roadmap', icon: ClipboardList },
  { label: 'Academic periods', href: '/admin/academic-periods', group: 'Roadmap', icon: CalendarDays },
  { label: 'Grades', href: '/admin/grades', group: 'Roadmap', icon: BookOpenCheck },
  { label: 'Attendance', href: '/admin/attendance', group: 'Roadmap', icon: ClipboardCheck },
  { label: 'Workflows', href: '/admin/workflows', group: 'Roadmap', icon: Workflow },
  { label: 'Reports', href: '/admin/reports', group: 'Roadmap', icon: FileText },
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
              <span className="admin-brand-subtitle">School console</span>
            </span>
          </Link>
          <nav aria-label="Admin navigation" className="admin-nav">
            {Object.entries(groupedNavItems).map(([group, items]) => (
              <div className="admin-nav-group" key={group}>
                <p>{group}</p>
                {items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      className="admin-nav-link"
                      data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      href={item.href}
                      key={item.label}
                    >
                      <span className="admin-nav-icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={2.3} />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
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
  if (pathname.startsWith('/admin/settings')) {
    return 'School';
  }

  if (pathname.startsWith('/admin/notifications')) {
    return 'Notifications';
  }

  if (pathname.startsWith('/admin/students')) {
    return 'Students';
  }

  if (pathname.startsWith('/admin/enrollments')) {
    return 'Enrollments';
  }

  if (pathname.startsWith('/admin/academic-periods')) {
    return 'Academic periods';
  }

  if (pathname.startsWith('/admin/grades')) {
    return 'Grades';
  }

  if (pathname.startsWith('/admin/attendance')) {
    return 'Attendance';
  }

  if (pathname.startsWith('/admin/workflows')) {
    return 'Workflows';
  }

  if (pathname.startsWith('/admin/academic-records')) {
    return 'Grades & attendance';
  }

  if (pathname.startsWith('/admin/reports')) {
    return 'Reports';
  }

  return 'Dashboard';
}
