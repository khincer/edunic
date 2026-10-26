import { AuthLoginPage } from '@/components/auth-login-page';
import { ADMIN_ROLES } from '@/lib/roles';

export default async function AdminLoginPage() {
  return (
    <AuthLoginPage
      accent="admin"
      allowedRoles={ADMIN_ROLES}
      brandSubtitle="Administration"
      brandTitle="Edunic"
      emailPlaceholder="admin@school.edu"
      heroText="Students, staff, grades, attendance and payments for your school."
      intro="Use your school administration account."
      redirectTo="/admin/dashboard"
      requiredRoleLabel="director, vice director or subdirector role"
      sectionLabel="Admin"
      title="Sign in"
    />
  );
}
