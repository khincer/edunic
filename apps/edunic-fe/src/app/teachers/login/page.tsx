import { AuthLoginPage } from '@/components/auth-login-page';
import { ADMIN_ROLES } from '@/lib/roles';

export default async function TeacherLoginPage() {
  return (
    <AuthLoginPage
      accent="teacher"
      allowedRoles={['teacher', ...ADMIN_ROLES]}
      brandSubtitle="Espacio de trabajo del docente"
      brandTitle="Edunic"
      emailPlaceholder="teacher@school.edu"
      heroText="Asistencia, calificaciones y novedades del aula para sus grupos."
      intro="Use su cuenta de docente. Las cuentas de administración del colegio también funcionan aquí."
      redirectTo="/teachers"
      requiredRoleLabel="el rol de Docente"
      sectionLabel="Docente"
      title="Iniciar sesión"
    />
  );
}
