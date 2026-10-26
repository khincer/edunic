import Link from 'next/link';

// Students are records, not logins (see AGENTS.md). Until student access is
// decided, this route only points families at the parent portal.
export default function StudentsPage() {
  return (
    <main className="portal-page">
      <section className="portal-hero">
        <h1 className="page-title">Las cuentas de estudiante no están disponibles</h1>
        <p className="body-copy">
          Las familias y tutores pueden seguir las calificaciones, la asistencia y
          los avisos del colegio en el portal de familias.
        </p>
        <div className="button-row section-stack">
          <Link className="button button-primary" href="/parents/login">
            Ir al portal de familias
          </Link>
        </div>
      </section>
    </main>
  );
}
