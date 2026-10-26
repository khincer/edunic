import { AuthLoginPage } from '@/components/auth-login-page';

export default async function ParentLoginPage() {
  return (
    <AuthLoginPage
      accent="parent"
      allowedRoles={['parent']}
      brandSubtitle="Portal de familias"
      brandTitle="Edunic"
      emailPlaceholder="parent@email.com"
      heroText="Calificaciones, asistencia, próximas tareas y avisos del colegio para sus hijos."
      intro="Use la cuenta de familia o tutor que le entregó el colegio."
      redirectTo="/parents"
      requiredRoleLabel="el rol de familia"
      sectionLabel="Familia"
      title="Iniciar sesión"
    />
  );
}
