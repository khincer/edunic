// The administrative group, mirroring ADMIN_ROLES in the domain
// (libs/domain/src/authorization/roles.ts). There is no `admin` role: the
// director, the vice director and the subdirector all run the school console.
export const ADMIN_ROLES = ['director', 'vice_director', 'subdirector'];

export function isAdminRole(role: string) {
  return ADMIN_ROLES.includes(role);
}

const roleLabels: Record<string, string> = {
  director: 'Director',
  vice_director: 'Vicedirector',
  subdirector: 'Subdirector',
  teacher: 'Docente',
  parent: 'Familia',
  student: 'Estudiante',
};

export function formatRole(role: string) {
  return roleLabels[role] ?? role;
}
