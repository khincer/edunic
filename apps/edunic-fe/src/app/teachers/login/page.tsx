import { AuthLoginPage } from '@/components/auth-login-page';
import { getRequestTenantContext } from '@/lib/server-tenant';

export default async function TeacherLoginPage() {
  const tenantContext = await getRequestTenantContext();

  return (
    <AuthLoginPage
      accent="teacher"
      allowedRoles={['teacher', 'admin']}
      brandSubtitle="Teacher workspace"
      brandTitle="Edunic Teachers"
      emailPlaceholder="teacher@school.edu"
      eyebrow="Classroom access"
      heroText="Focused tools for every lesson, roster, and roll call."
      initialTenantContext={tenantContext}
      intro="Sign in with a teacher account, or an admin account helping with classroom operations."
      redirectTo="/teachers"
      requiredRoleLabel="teacher role"
      sectionLabel="Teacher"
      title="Open teacher tools"
    />
  );
}
