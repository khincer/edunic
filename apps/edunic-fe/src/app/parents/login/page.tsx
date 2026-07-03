import { AuthLoginPage } from '@/components/auth-login-page';
import { getRequestTenantContext } from '@/lib/server-tenant';

export default async function ParentLoginPage() {
  const tenantContext = await getRequestTenantContext();

  return (
    <AuthLoginPage
      accent="parent"
      allowedRoles={['parent']}
      brandSubtitle="Parent portal"
      brandTitle="Edunic Families"
      emailPlaceholder="parent@email.com"
      eyebrow="Family access"
      heroText="A clear window into progress, attendance, and care."
      initialTenantContext={tenantContext}
      intro="Sign in with the parent or guardian account assigned by the school."
      redirectTo="/parents"
      requiredRoleLabel="parent role"
      sectionLabel="Parent"
      title="Enter family portal"
    />
  );
}
