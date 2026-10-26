import Link from 'next/link';

// Students are records, not logins (see AGENTS.md). Until student access is
// decided, this route only points families at the parent portal.
export default function StudentsPage() {
  return (
    <main className="portal-page">
      <section className="portal-hero">
        <h1 className="page-title">Student accounts are not available</h1>
        <p className="body-copy">
          Parents and guardians can follow grades, attendance and school notices
          in the family portal.
        </p>
        <div className="button-row section-stack">
          <Link className="button button-primary" href="/parents/login">
            Go to the family portal
          </Link>
        </div>
      </section>
    </main>
  );
}
