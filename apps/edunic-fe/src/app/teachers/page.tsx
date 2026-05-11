import Link from 'next/link';

const workBlocks = [
  {
    title: 'Homeroom',
    metric: '28',
    text: 'students in today attendance roster',
  },
  {
    title: 'Pending grades',
    metric: '14',
    text: 'submissions ready for review',
  },
  {
    title: 'Alerts',
    metric: '3',
    text: 'attendance patterns needing attention',
  },
];

export default function TeachersPage() {
  return (
    <main className="portal-page">
      <nav className="portal-topnav" aria-label="Teacher section navigation">
        <Link href="/">Edunic</Link>
        <div>
          <Link href="/admin">Admin</Link>
          <Link href="/students">Students</Link>
        </div>
      </nav>

      <section className="portal-hero">
        <p className="eyebrow">Teacher workspace</p>
        <h1 className="page-title">Classroom operations, ready for the next module.</h1>
        <p className="body-copy">
          This section is reserved for teachers: attendance, grade submission,
          class rosters, and reporting workflows will live under the same
          frontend host.
        </p>
      </section>

      <section className="portal-grid">
        {workBlocks.map((block) => (
          <article className="card" key={block.title}>
            <p className="eyebrow">{block.title}</p>
            <p className="metric">{block.metric}</p>
            <p className="body-copy">{block.text}</p>
          </article>
        ))}
      </section>

      <section className="card card-soft portal-band">
        <div>
          <p className="eyebrow">Route plan</p>
          <h2 className="section-title">Teacher pages stay under /teachers</h2>
        </div>
        <p className="body-copy">
          Future routes can be added as /teachers/classes, /teachers/attendance,
          /teachers/grades, and /teachers/reports without creating another
          Next.js application.
        </p>
      </section>
    </main>
  );
}
