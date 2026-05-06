import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ReportsPdfService } from '../modules/reports/application/reports-pdf.service.js';
import {
  ReportsService,
  ReportsServiceError,
} from '../modules/reports/application/reports.service.js';
import { ReportsRepository } from '../modules/reports/infrastructure/reports.repository.js';
import {
  institutionHeaderSchema,
  studentReportParamsSchema,
  studentReportQuerySchema,
} from '../modules/reports/schemas/reports.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new ReportsServiceError(
        firstIssue?.message ?? 'Invalid request',
        400
      );
    }

    throw error;
  }
}

function getInstitutionId(request: FastifyRequest) {
  const headers = parseWithSchema(institutionHeaderSchema, request.headers);
  return headers['x-institution-id'];
}

export async function reportRoutes(app: FastifyInstance) {
  const reportsService = new ReportsService(new ReportsRepository(app.db));
  const reportsPdfService = new ReportsPdfService();

  app.get('/students/:studentId/academic-summary', async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentReportParamsSchema, request.params);
    const query = parseWithSchema(studentReportQuerySchema, request.query);

    return reportsService.getStudentAcademicSummary({
      institutionId,
      studentId: params.studentId,
      year: query.year,
    });
  });

  app.get('/students/:studentId/academic-summary/pdf', async (request, reply) => {
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
