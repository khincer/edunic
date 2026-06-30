import Link from 'next/link';

const sections = [
  {
    href: '/admin/login',
    label: 'Admin',
    title: 'Institution management',
    text: 'Manage schools, extensions, audit trails, and platform operations.',
  },
  {
    href: '/teachers/login',
    label: 'Teacher',
    title: 'Classroom tools',
    text: 'Mark attendance, submit grades, and work from assigned rosters.',
  },
  {
    href: '/parents/login',
    label: 'Parent',
    title: 'Family portal',
    text: 'Read linked student grades, attendance, reports, and school notices.',
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
          and parents now have separate access points under each institution domain.
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
