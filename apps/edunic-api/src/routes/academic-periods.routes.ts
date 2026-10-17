import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  getInstitutionId,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  AcademicPeriodsService,
  AcademicPeriodsServiceError,
  AcademicPeriodsRepository,
  academicPeriodParamsSchema,
  listAcademicPeriodsQuerySchema,
  createAcademicPeriodBodySchema,
  updateAcademicPeriodBodySchema,
} from '@edunic/source/domain/academic-periods';

const ACADEMIC_PERIOD_FILTER_SORT_OPTIONS = {
  filterFields: ['year', 'term', 'startDate', 'endDate', 'createdAt'],
  sortFields: ['year', 'term', 'startDate', 'endDate', 'createdAt'],
};

export async function academicPeriodRoutes(app: FastifyInstance) {
  const academicPeriodsService = new AcademicPeriodsService(
    new AcademicPeriodsRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listAcademicPeriodsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      ACADEMIC_PERIOD_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return academicPeriodsService.listAcademicPeriods({
      institutionId,
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:academicPeriodId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(academicPeriodParamsSchema, request.params);

    return academicPeriodsService.getAcademicPeriod(
      institutionId,
      params.academicPeriodId
    );
  });

  app.post('/', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createAcademicPeriodBodySchema, request.body);
    const result = await academicPeriodsService.createAcademicPeriod({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:academicPeriodId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(academicPeriodParamsSchema, request.params);
    const body = parseWithSchema(updateAcademicPeriodBodySchema, request.body);

    return academicPeriodsService.updateAcademicPeriod({
      institutionId,
      academicPeriodId: params.academicPeriodId,
      ...body,
    });
  });

  app.delete('/:academicPeriodId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(academicPeriodParamsSchema, request.params);

    return academicPeriodsService.deleteAcademicPeriod(
      institutionId,
      params.academicPeriodId
    );
  });
}
