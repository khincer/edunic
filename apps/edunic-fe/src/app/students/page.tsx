import Link from 'next/link';

const familyCards = [
  {
    title: 'Grades',
    metric: 'B+',
    text: 'current academic snapshot across linked students',
  },
  {
    title: 'Attendance',
    metric: '96%',
    text: 'recent presence rate for the active period',
  },
  {
    title: 'Reports',
    metric: '4',
    text: 'school documents ready for parents and guardians',
  },
];

export default function StudentsPage() {
  return (
    <main className="portal-page">
      <nav className="portal-topnav" aria-label="Student and parent section navigation">
        <Link href="/">Edunic</Link>
        <div>
          <Link href="/admin">Admin</Link>
          <Link href="/teachers">Teachers</Link>
          <Link href="/parents/login">Parents</Link>
        </div>
      </nav>

      <section className="portal-hero">
        <p className="eyebrow">Students</p>
        <h1 className="page-title">A student view for academic progress.</h1>
        <p className="body-copy">
          Students use this section for grades, attendance, notifications,
          reports, and read-only school updates. Parents now have their own
          access path.
        </p>
      </section>

      <section className="portal-grid">
        {familyCards.map((card) => (
          <article className="card" key={card.title}>
            <p className="eyebrow">{card.title}</p>
            <p className="metric">{card.metric}</p>
            <p className="body-copy">{card.text}</p>
          </article>
        ))}
      </section>

      <section className="card card-soft portal-band">
        <div>
          <p className="eyebrow">Parent access</p>
          <h2 className="section-title">Dedicated parent login is available</h2>
        </div>
        <p className="body-copy">
          Parents and guardians should use /parents/login so their read-only
          portal can enforce the parent role separately from student access.
        </p>
      </section>
    </main>
  );
}
