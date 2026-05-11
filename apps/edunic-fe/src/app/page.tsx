import Link from 'next/link';

const sections = [
  {
    href: '/admin',
    label: 'Admin',
    title: 'Institution management',
    text: 'Manage schools, extensions, audit trails, and platform operations.',
  },
  {
    href: '/teachers',
    label: 'Teachers',
    title: 'Classroom analytics',
    text: 'Review attendance, averages, and classroom alerts in one teaching surface.',
  },
  {
    href: '/students',
    label: 'Students & parents',
    title: 'Family observatory',
    text: 'See grades, attendance, reports, and notifications for linked students.',
  },
];

export default function Home() {
  return (
    <main className="portal-page">
      <section className="portal-hero">
        <p className="eyebrow">Edunic unified portal</p>
        <h1 className="page-title">One Next.js app, three focused workspaces.</h1>
        <p className="body-copy">
          Choose the section that matches the user journey. Admins, teachers,
          students, and parents now share the same frontend host.
        </p>

        <div className="portal-grid">
          {sections.map((section) => (
            <Link className="card card-soft" href={section.href} key={section.href}>
              <span className="badge badge-blue">{section.label}</span>
              <h2 className="section-title">{section.title}</h2>
              <p className="body-copy">{section.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
