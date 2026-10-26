import type { FastifyInstance } from 'fastify';
import { parseWithSchema } from '@edunic/source/domain/shared';
import {
  ReportsService,
  ReportsPdfService,
  ReportsRepository,
  exportGradesCsvQuerySchema,
  listReportHistoryQuerySchema,
  studentReportParamsSchema,
  studentReportQuerySchema,
} from '@edunic/source/domain/reports';
import {
  AccessRepository,
  AccessService,
  adminAnd,
} from '@edunic/source/domain/authorization';
import { actorOf } from './actor.js';

export async function reportRoutes(app: FastifyInstance) {
  const reportsService = new ReportsService(
    new ReportsRepository(app.db),
    new AccessService(new AccessRepository(app.db)),
    new ReportsPdfService()
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const historyAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher'))],
  };

  app.get('/history', historyAccess, async (request, reply) => {
    const query = parseWithSchema(listReportHistoryQuerySchema, request.query);

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return reportsService.listReportHistory({
      ...query,
      actor: actorOf(request),
    });
  });

  app.get('/export.csv', readAccess, async (request, reply) => {
    const query = parseWithSchema(exportGradesCsvQuerySchema, request.query);

    const result = await reportsService.exportGradesCsv({
      ...query,
      actor: actorOf(request),
    });

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.csv);
  });

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

    const result = await reportsService.exportStudentAcademicSummaryPdf({
      studentId: params.studentId,
      year: query.year,
      actor: actorOf(request),
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${result.filename}"`)
      .send(result.pdf);
  });
}
