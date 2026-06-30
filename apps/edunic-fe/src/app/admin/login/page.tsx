import { AuthLoginPage } from '@/components/auth-login-page';

const adminShortcuts = [
  {
    label: 'Central admin',
    email: 'admin@central.edu',
    password: 'admin1234',
    institutionId: '00000000-0000-0000-0000-000000000001',
  },
  {
    label: 'North admin',
    email: 'admin@north.edu',
    password: 'admin1234',
    institutionId: '00000000-0000-0000-0000-000000000002',
  },
];

export default function AdminLoginPage() {
  return (
    <AuthLoginPage
      accent="admin"
      activeLabel="Active institution"
      allowedRoles={['admin']}
      brandSubtitle="Institution console"
      brandTitle="Edunic Admin"
      capabilities={['Students', 'Enrollments', 'Feature flags', 'Extensions', 'Audit logs', 'Reports']}
      emailPlaceholder="admin@school.edu"
      eyebrow="Secure admin access"
      heroEyebrow="Multi-tenant operations"
      heroText="Every admin session carries a tenant UUID, keeping students, grades, attendance, extensions, and audit trails attached to the correct school."
      heroTitle="Institution scoped from the first request."
      intro="Sign in with the admin account assigned to the school tenant."
      redirectTo="/admin/dashboard"
      requiredRoleLabel="admin role"
      sectionLabel="Admin"
      shortcuts={adminShortcuts}
      signupText="Create the institution record after signing in as a platform or institution admin."
      signupTitle="New school?"
      title="Welcome back"
    />
  );
}
