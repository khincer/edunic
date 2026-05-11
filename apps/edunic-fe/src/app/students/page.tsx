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
        </div>
      </nav>

      <section className="portal-hero">
        <p className="eyebrow">Students and parents</p>
        <h1 className="page-title">A shared family view for academic progress.</h1>
        <p className="body-copy">
          Students and parents use this section for grades, attendance,
          notifications, reports, and read-only school updates.
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
          <h2 className="section-title">/parents redirects here</h2>
        </div>
        <p className="body-copy">
          Parent and student experiences share /students for now. If role-based
          flows split later, the redirect can become a dedicated parent route
          without another app.
        </p>
      </section>
    </main>
  );
}
