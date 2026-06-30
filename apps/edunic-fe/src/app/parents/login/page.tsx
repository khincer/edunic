import { AuthLoginPage } from '@/components/auth-login-page';

const parentShortcuts = [
  {
    label: 'Central parent',
    email: 'parent@central.edu',
    password: 'parent1234',
    institutionId: '00000000-0000-0000-0000-000000000001',
  },
];

export default function ParentLoginPage() {
  return (
    <AuthLoginPage
      accent="parent"
      activeLabel="Family portal"
      allowedRoles={['parent']}
      brandSubtitle="Parent portal"
      brandTitle="Edunic Families"
      capabilities={['Linked students', 'Grades', 'Attendance', 'Reports', 'Notices', 'Read-only']}
      emailPlaceholder="parent@email.com"
      eyebrow="Family access"
      heroEyebrow="Read-only academic view"
      heroText="Parent sessions are scoped to one school and should only expose linked student progress, attendance, reports, and school notices."
      heroTitle="A calmer window into student progress."
      intro="Sign in with the parent or guardian account assigned by the school."
      redirectTo="/parents"
      requiredRoleLabel="parent role"
      sectionLabel="Parent"
      shortcuts={parentShortcuts}
      signupText="Your school must create your guardian account and link it to a student."
      signupTitle="Need access?"
      title="Enter family portal"
    />
  );
}
