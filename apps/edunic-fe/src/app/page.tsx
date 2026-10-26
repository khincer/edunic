import Link from 'next/link';

const sections = [
  {
    href: '/admin/login',
    title: 'Administration',
    text: 'Students, staff, subjects, reports and payments.',
  },
  {
    href: '/teachers/login',
    title: 'Teachers',
    text: 'Attendance, grades and classroom updates.',
  },
  {
    href: '/parents/login',
    title: 'Families',
    text: 'Grades, attendance and notices for your children.',
  },
];

export default function Home() {
  return (
    <main className="portal-page">
      <section className="portal-hero">
        <h1 className="page-title">Sign in to Edunic</h1>
        <p className="body-copy">Choose the portal for your account.</p>
      </section>

      <div className="portal-grid">
        {sections.map((section) => (
          <Link className="card metric-card" href={section.href} key={section.href}>
            <h2 className="section-title">{section.title}</h2>
            <p className="body-copy">{section.text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
