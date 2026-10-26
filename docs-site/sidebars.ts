import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: ['getting-started/sign-in', 'getting-started/roles-and-permissions'],
    },
    {
      type: 'category',
      label: 'Admin guide',
      collapsed: false,
      items: [
        'admin/overview',
        'admin/school-profile',
        'admin/teachers-and-subjects',
        'admin/payments',
        'admin/classroom-activity',
        'admin/academic-periods',
        'admin/students-and-guardians',
        'admin/enrollments',
        'admin/attendance',
        'admin/grades',
        'admin/workflows',
        'admin/reports',
        'admin/audit-logs',
      ],
    },
    {
      type: 'category',
      label: 'Teacher guide',
      collapsed: false,
      items: [
        'teacher/overview',
        'teacher/attendance',
        'teacher/grades',
        'teacher/assignments',
        'teacher/messages',
        'teacher/reports',
      ],
    },
    {
      type: 'category',
      label: 'Parent guide',
      collapsed: false,
      items: [
        'parent/overview',
        'parent/grades-and-reports',
        'parent/attendance',
        'parent/notifications',
        'parent/messages',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: ['reference/api-conventions', 'reference/error-codes'],
    },
  ],
};

export default sidebars;
