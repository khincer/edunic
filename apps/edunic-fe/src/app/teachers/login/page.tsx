import { AuthLoginPage } from '@/components/auth-login-page';

const teacherShortcuts = [
  {
    label: 'Central teacher',
    email: 'teacher@central.edu',
    password: 'teacher1234',
    institutionId: '00000000-0000-0000-0000-000000000001',
  },
  {
    label: 'Central admin',
    email: 'admin@central.edu',
    password: 'admin1234',
    institutionId: '00000000-0000-0000-0000-000000000001',
  },
];

export default function TeacherLoginPage() {
  return (
    <AuthLoginPage
      accent="teacher"
      activeLabel="Classroom tenant"
      allowedRoles={['teacher', 'admin']}
      brandSubtitle="Teacher workspace"
      brandTitle="Edunic Teachers"
      capabilities={['Rosters', 'Attendance', 'Grades', 'Classrooms', 'Daily status', 'Submissions']}
      emailPlaceholder="teacher@school.edu"
      eyebrow="Classroom access"
      heroEyebrow="Daily classroom operations"
      heroText="Teacher sessions stay tied to one institution, so rosters, attendance, and grade submissions never cross school boundaries."
      heroTitle="One working surface for the school day."
      intro="Sign in with a teacher account, or an admin account helping with classroom operations."
      redirectTo="/teachers"
      requiredRoleLabel="teacher role"
      sectionLabel="Teacher"
      shortcuts={teacherShortcuts}
      signupText="A school admin must create or invite your staff account before you can enter."
      signupTitle="Need access?"
      title="Open teacher tools"
    />
  );
}
