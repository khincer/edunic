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
  Layers,
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
import { formatRole, isAdminRole } from '@/lib/roles';
import { AdminInbox } from './admin-inbox';
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
    label: 'Resumen',
    items: [{ label: 'Panel principal', href: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Personas',
    items: [
      { label: 'Estudiantes', href: '/admin/students', icon: UsersRound },
      { label: 'Docentes', href: '/admin/teachers', icon: GraduationCap },
      { label: 'Matrículas', href: '/admin/enrollments', icon: ClipboardList },
    ],
  },
  {
    label: 'Académico',
    items: [
      { label: 'Grados', href: '/admin/grados', icon: Layers },
      { label: 'Materias', href: '/admin/subjects', icon: Library },
      { label: 'Períodos académicos', href: '/admin/academic-periods', icon: CalendarDays },
      { label: 'Calificaciones', href: '/admin/grades', icon: BookOpenCheck },
      { label: 'Asistencia', href: '/admin/attendance', icon: ClipboardCheck },
      { label: 'Informes', href: '/admin/reports', icon: FileText },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Actividad de aula', href: '/admin/activity', icon: Activity },
      { label: 'Flujos de trabajo', href: '/admin/workflows', icon: Workflow },
      { label: 'Pagos', href: '/admin/payments', icon: Wallet },
      { label: 'Notificaciones', href: '/admin/notifications', icon: Bell },
      { label: 'Configuración del colegio', href: '/admin/settings', icon: Building2 },
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
          <section className="empty-state body-copy">Verificando tu sesión…</section>
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
            <h1 className="page-title">Esta consola es para la administración del colegio</h1>
            <p className="body-copy">
              Has iniciado sesión como {session.user.email} ({session.user.role}).
            </p>
            <div className="button-row">
              {portal ? (
                <ButtonLink href={portal.href}>{portal.label}</ButtonLink>
              ) : null}
              <Button onClick={handleLogout} variant="secondary">
                Cerrar sesión
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
              <span className="admin-brand-subtitle">Administración</span>
            </span>
          </Link>
          <nav aria-label="Navegación de administración" className="admin-nav">
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
              aria-label="Cerrar sesión"
              className="button-small"
              onClick={handleLogout}
              title="Cerrar sesión"
              variant="ghost"
            >
              <LogOut aria-hidden="true" size={16} strokeWidth={2} />
            </Button>
          </div>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar">
            <AdminInbox userId={session.user.id} />
          </header>
          <div className="admin-content">{children}</div>
        </section>
      </div>
    </main>
  );
}

function getPortalFor(role: string) {
  if (role === 'teacher') {
    return { href: '/teachers', label: 'Ir al portal docente' };
  }

  if (role === 'parent') {
    return { href: '/parents', label: 'Ir al portal de familias' };
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
