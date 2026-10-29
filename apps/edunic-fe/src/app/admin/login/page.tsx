import { AuthLoginPage } from '@/components/auth-login-page';
import { ADMIN_ROLES } from '@/lib/roles';

export default async function AdminLoginPage() {
  return (
    <AuthLoginPage
      accent="admin"
      allowedRoles={ADMIN_ROLES}
      brandSubtitle="Administración"
      brandTitle="Edunic"
      emailPlaceholder="admin@colegio.edu"
      heroText="Estudiantes, personal, calificaciones, asistencia y pagos de su colegio."
      intro="Use su cuenta de administración del colegio."
      redirectTo="/admin/dashboard"
      requiredRoleLabel="el rol de Director, Vicedirector o Subdirector"
      sectionLabel="Administración"
      title="Iniciar sesión"
    />
  );
}
