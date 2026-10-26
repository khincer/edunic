import Link from 'next/link';

const sections = [
  {
    href: '/admin/login',
    title: 'Administración',
    text: 'Estudiantes, personal, materias, informes y pagos.',
  },
  {
    href: '/teachers/login',
    title: 'Docentes',
    text: 'Asistencia, calificaciones y novedades del aula.',
  },
  {
    href: '/parents/login',
    title: 'Familias',
    text: 'Calificaciones, asistencia y avisos de tus hijos.',
  },
];

export default function Home() {
  return (
    <main className="portal-page">
      <section className="portal-hero">
        <h1 className="page-title">Iniciar sesión</h1>
        <p className="body-copy">Elige el portal de tu cuenta.</p>
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
