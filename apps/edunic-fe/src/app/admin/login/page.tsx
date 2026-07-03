import { AuthLoginPage } from '@/components/auth-login-page';
import { getRequestTenantContext } from '@/lib/server-tenant';

export default async function AdminLoginPage() {
  const tenantContext = await getRequestTenantContext();

  return (
    <AuthLoginPage
      accent="admin"
      allowedRoles={['admin']}
      brandSubtitle="Institution console"
      brandTitle="Edunic Admin"
      emailPlaceholder="admin@school.edu"
      eyebrow="Secure admin access"
      heroText="Every school deserves a calm command center."
      initialTenantContext={tenantContext}
      intro="Sign in with the admin account assigned to the school tenant."
      redirectTo="/admin/dashboard"
      requiredRoleLabel="admin role"
      sectionLabel="Admin"
      title="Welcome back"
    />
  );
}
