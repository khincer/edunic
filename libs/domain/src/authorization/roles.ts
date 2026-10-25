// The administrative group: the roles that hold the capabilities the spec
// calls "admin". There is no `admin` role any more; the director, the vice
// director and the subdirector are all administrative. Routes and guards name
// this group instead of repeating the list.
export const ADMIN_ROLES = ['director', 'vice_director', 'subdirector'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AudienceRole = 'admin' | 'teacher' | 'parent';

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

// The roles of a route that admits the administrative group plus others.
export function adminAnd(...roles: string[]): string[] {
  return [...ADMIN_ROLES, ...roles];
}

// Notifications, assignments and events carry an audience of `admin`,
// `teacher` or `parent`: the whole administrative group reads the `admin`
// audience, so stored audiences stay valid.
export function toAudienceRole(role: string): AudienceRole {
  if (isAdminRole(role)) {
    return 'admin';
  }

  // Anything else gets the narrowest audience.
  return role === 'teacher' ? 'teacher' : 'parent';
}
