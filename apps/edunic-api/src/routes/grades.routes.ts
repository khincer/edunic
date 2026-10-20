import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  getInstitutionId,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import { AccessRepository, AccessService } from '@edunic/source/domain/authorization';
import {
  GradesService,
  GradesServiceError,
  GradesRepository,
  createGradeBodySchema,
  gradeParamsSchema,
  listGradesQuerySchema,
  updateGradeBodySchema,
} from '@edunic/source/domain/grades';

const GRADE_FILTER_SORT_OPTIONS = {
  filterFields: ['subject', 'score', 'enrollmentId', 'createdAt'],
  sortFields: ['subject', 'score', 'createdAt'],
};

export async function gradeRoutes(app: FastifyInstance) {
  const gradesService = new GradesService(
    new GradesRepository(app.db),
    app.eventBus,
    new AccessService(new AccessRepository(app.db))
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const academicWriteAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher'])],
  };

  app.get('/', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listGradesQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      GRADE_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return gradesService.listGrades({
      institutionId,
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:gradeId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(gradeParamsSchema, request.params);

    return gradesService.getGrade(institutionId, params.gradeId);
  });

  app.post('/', academicWriteAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createGradeBodySchema, request.body);
    const result = await gradesService.createGrade({
      institutionId,
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:gradeId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(gradeParamsSchema, request.params);
    const body = parseWithSchema(updateGradeBodySchema, request.body);

    return gradesService.updateGrade({
      institutionId,
      gradeId: params.gradeId,
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
      ...body,
    });
  });

  app.delete('/:gradeId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(gradeParamsSchema, request.params);

    return gradesService.deleteGrade(institutionId, params.gradeId, {
      role: request.user?.role ?? '',
      userId: request.user?.id ?? '',
    });
  });
}
