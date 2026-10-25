import { AuthLoginPage } from '@/components/auth-login-page';
import { ADMIN_ROLES } from '@/lib/roles';

export default async function AdminLoginPage() {
  return (
    <AuthLoginPage
      accent="admin"
      allowedRoles={ADMIN_ROLES}
      brandSubtitle="School console"
      brandTitle="Edunic Admin"
      emailPlaceholder="admin@school.edu"
      eyebrow="Secure admin access"
      heroText="Every school deserves a calm command center."
      intro="Sign in with the admin account for your school."
      redirectTo="/admin/dashboard"
      requiredRoleLabel="director, vice director or subdirector role"
      sectionLabel="Admin"
      title="Welcome back"
    />
  );
}
