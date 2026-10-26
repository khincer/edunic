import { AuthLoginPage } from '@/components/auth-login-page';

export default async function ParentLoginPage() {
  return (
    <AuthLoginPage
      accent="parent"
      allowedRoles={['parent']}
      brandSubtitle="Parent portal"
      brandTitle="Edunic"
      emailPlaceholder="parent@email.com"
      heroText="Grades, attendance, upcoming work and school notices for your children."
      intro="Use the parent or guardian account the school gave you."
      redirectTo="/parents"
      requiredRoleLabel="parent role"
      sectionLabel="Parent"
      title="Sign in"
    />
  );
}
