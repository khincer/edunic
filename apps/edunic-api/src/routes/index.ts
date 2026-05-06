import { academicAverageRoutes } from './academic-averages.routes.js';
import { adminRoutes } from './admin.routes.js';
import { attendanceRoutes } from './attendance.routes.js';
import { academicPeriodRoutes } from './academic-periods.routes.js';
import { docsRoutes } from './docs.routes.js';
import type { FastifyInstance } from 'fastify';
import { enrollmentRoutes } from './enrollments.routes.js';
import { guardianRoutes } from './guardians.routes.js';
import { gradeRoutes } from './grades.routes.js';
import { healthRoutes } from './health.routes.js';
import { institutionRoutes } from './institutions.routes.js';
import { reportRoutes } from './reports.routes.js';
import { studentRoutes } from './students.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  app.register(academicAverageRoutes, { prefix: '/academic-averages' });
  app.register(adminRoutes, { prefix: '/admin' });
  app.register(academicPeriodRoutes, { prefix: '/academic-periods' });
  app.register(attendanceRoutes, { prefix: '/attendance' });
  app.register(docsRoutes, { prefix: '/docs' });
  app.register(enrollmentRoutes, { prefix: '/enrollments' });
  app.register(guardianRoutes);
  app.register(gradeRoutes, { prefix: '/grades' });
  app.register(healthRoutes, { prefix: '/health' });
  app.register(institutionRoutes, { prefix: '/institutions' });
  app.register(reportRoutes, { prefix: '/reports' });
  app.register(studentRoutes, { prefix: '/students' });
}
