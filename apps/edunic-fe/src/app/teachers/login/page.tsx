import { AuthLoginPage } from '@/components/auth-login-page';

export default async function TeacherLoginPage() {
  return (
    <AuthLoginPage
      accent="teacher"
      allowedRoles={['teacher', 'admin']}
      brandSubtitle="Teacher workspace"
      brandTitle="Edunic Teachers"
      emailPlaceholder="teacher@school.edu"
      eyebrow="Classroom access"
      heroText="Focused tools for every lesson, roster, and roll call."
      intro="Sign in with a teacher account, or an admin account helping with classroom operations."
      redirectTo="/teachers"
      requiredRoleLabel="teacher role"
      sectionLabel="Teacher"
      title="Open teacher tools"
    />
  );
}
