import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema } from '@edunic/source/domain/shared';
import {
  ReportsService,
  ReportsPdfService,
  ReportsRepository,
  studentReportParamsSchema,
  studentReportQuerySchema,
} from '@edunic/source/domain/reports';
import {
  AccessRepository,
  AccessService,
  adminAnd,
} from '@edunic/source/domain/authorization';

export async function reportRoutes(app: FastifyInstance) {
  const reportsService = new ReportsService(
    new ReportsRepository(app.db),
    new AccessService(new AccessRepository(app.db))
  );
  const reportsPdfService = new ReportsPdfService();
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };

  app.get('/students/:studentId/academic-summary', readAccess, async (request) => {
    const params = parseWithSchema(studentReportParamsSchema, request.params);
    const query = parseWithSchema(studentReportQuerySchema, request.query);

    return reportsService.getStudentAcademicSummary({
      studentId: params.studentId,
      year: query.year,
      actor: actorOf(request),
    });
  });

  app.get('/students/:studentId/academic-summary/pdf', readAccess, async (request, reply) => {
    const params = parseWithSchema(studentReportParamsSchema, request.params);
    const query = parseWithSchema(studentReportQuerySchema, request.query);

    const result = await reportsService.getStudentAcademicSummary({
      studentId: params.studentId,
      year: query.year,
      actor: actorOf(request),
    });

    const pdf = await reportsPdfService.renderStudentAcademicSummaryPdf(
      result.data
    );

    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="student-academic-summary-${params.studentId}-${query.year}.pdf"`
      )
      .send(pdf);
  });
}

function actorOf(request: FastifyRequest) {
  return {
    role: request.user?.role ?? '',
    userId: request.user?.id ?? '',
  };
}
