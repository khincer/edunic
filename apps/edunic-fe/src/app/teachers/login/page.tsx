import { AuthLoginPage } from '@/components/auth-login-page';
import { ADMIN_ROLES } from '@/lib/roles';

export default async function TeacherLoginPage() {
  return (
    <AuthLoginPage
      accent="teacher"
      allowedRoles={['teacher', ...ADMIN_ROLES]}
      brandSubtitle="Teacher workspace"
      brandTitle="Edunic"
      emailPlaceholder="teacher@school.edu"
      heroText="Attendance, grades and classroom updates for your groups."
      intro="Use your teacher account. School administration accounts also work here."
      redirectTo="/teachers"
      requiredRoleLabel="teacher role"
      sectionLabel="Teacher"
      title="Sign in"
    />
  );
}
