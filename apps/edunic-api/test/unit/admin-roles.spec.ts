import {
  ADMIN_ROLES,
  adminAnd,
  isAdminRole,
  toAudienceRole,
} from '@edunic/source/domain/authorization';

describe('administrative role group', () => {
  it('is made of the director, vice director and subdirector', () => {
    expect([...ADMIN_ROLES]).toEqual(['director', 'vice_director', 'subdirector']);
  });

  it.each(['director', 'vice_director', 'subdirector'])(
    'recognises %s as administrative',
    (role) => {
      expect(isAdminRole(role)).toBe(true);
    }
  );

  it.each(['teacher', 'parent', 'admin', ''])(
    'does not treat %p as administrative',
    (role) => {
      expect(isAdminRole(role)).toBe(false);
    }
  );

  it('extends the group with the other roles a route admits', () => {
    expect(adminAnd('teacher')).toEqual([
      'director',
      'vice_director',
      'subdirector',
      'teacher',
    ]);
    expect(adminAnd('teacher', 'parent')).toHaveLength(5);
  });

  it('maps every administrative role to the admin audience', () => {
    expect(toAudienceRole('vice_director')).toBe('admin');
    expect(toAudienceRole('teacher')).toBe('teacher');
    expect(toAudienceRole('parent')).toBe('parent');
  });
});
