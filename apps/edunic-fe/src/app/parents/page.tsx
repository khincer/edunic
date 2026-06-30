'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getSession, type AdminSession } from '@/lib/auth';

const parentCards = [
  {
    title: 'Grades',
    metric: 'Read',
    text: 'review scores and academic reports for linked students',
  },
  {
    title: 'Attendance',
    metric: 'Track',
    text: 'follow presence, late arrivals, and absence patterns',
  },
  {
    title: 'Reports',
    metric: 'Open',
    text: 'access generated school documents when reports are enabled',
  },
];

export default function ParentsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedSession = getSession();
    setSession(storedSession);
    setReady(true);

    if (!storedSession) {
      router.replace('/parents/login');
    }
  }, [router]);

  function handleSignOut() {
    clearSession();
    setSession(null);
    router.replace('/parents/login');
  }

  if (!ready || !session) {
    return (
      <main className="portal-page">
        <nav className="portal-topnav" aria-label="Parent section navigation">
          <Link href="/">Edunic</Link>
          <div>
            <Link href="/admin/login">Admin</Link>
            <Link href="/teachers/login">Teachers</Link>
          </div>
        </nav>
        <section className="empty-state body-copy">Opening parent portal...</section>
      </main>
    );
  }

  const canUseParentPortal = session.user.role === 'parent';

  return (
    <main className="portal-page">
      <nav className="portal-topnav" aria-label="Parent section navigation">
        <Link href="/">Edunic</Link>
        <div>
          <Link href="/admin/login">Admin</Link>
          <Link href="/teachers/login">Teachers</Link>
          <button className="link-button" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </nav>

      <section className="portal-hero">
        <p className="eyebrow">Parent portal</p>
        <h1 className="page-title">Read-only family access.</h1>
        <p className="body-copy">
          {session.user.email} is signed in for institution {session.user.institutionId}.
        </p>
      </section>

      {!canUseParentPortal ? (
        <div className="alert alert-error">
          This portal requires a parent role. Sign in with a parent or guardian account.
        </div>
      ) : null}

      {canUseParentPortal ? (
        <>
          <section className="portal-grid">
            {parentCards.map((card) => (
              <article className="card" key={card.title}>
                <p className="eyebrow">{card.title}</p>
                <p className="metric">{card.metric}</p>
                <p className="body-copy">{card.text}</p>
              </article>
            ))}
          </section>

          <section className="card card-soft portal-band">
            <div>
              <p className="eyebrow">Linked students</p>
              <h2 className="section-title">Guardian links are the next data step</h2>
            </div>
            <p className="body-copy">
              The backend already models guardians and student links. This parent
              portal is ready to render those linked records once the frontend
              query is connected.
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}
