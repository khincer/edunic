import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  ReportsService,
  ReportsServiceError,
  ReportsPdfService,
  ReportsRepository,
  institutionHeaderSchema,
  studentReportParamsSchema,
  studentReportQuerySchema,
} from '@edunic/source/domain/reports';

export async function reportRoutes(app: FastifyInstance) {
  const reportsService = new ReportsService(new ReportsRepository(app.db));
  const reportsPdfService = new ReportsPdfService();
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };

  app.get('/students/:studentId/academic-summary', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentReportParamsSchema, request.params);
    const query = parseWithSchema(studentReportQuerySchema, request.query);

    return reportsService.getStudentAcademicSummary({
      institutionId,
      studentId: params.studentId,
      year: query.year,
    });
  });

  app.get('/students/:studentId/academic-summary/pdf', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentReportParamsSchema, request.params);
    const query = parseWithSchema(studentReportQuerySchema, request.query);

    const result = await reportsService.getStudentAcademicSummary({
      institutionId,
      studentId: params.studentId,
      year: query.year,
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
