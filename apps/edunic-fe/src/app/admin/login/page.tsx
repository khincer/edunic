import { AuthLoginPage } from '@/components/auth-login-page';

export default async function AdminLoginPage() {
  return (
    <AuthLoginPage
      accent="admin"
      allowedRoles={['admin']}
      brandSubtitle="School console"
      brandTitle="Edunic Admin"
      emailPlaceholder="admin@school.edu"
      eyebrow="Secure admin access"
      heroText="Every school deserves a calm command center."
      intro="Sign in with the admin account for your school."
      redirectTo="/admin/dashboard"
      requiredRoleLabel="admin role"
      sectionLabel="Admin"
      title="Welcome back"
    />
  );
}
