import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
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
import { ADMIN_ROLES, adminAnd } from '@edunic/source/domain/authorization';

const ACADEMIC_PERIOD_FILTER_SORT_OPTIONS = {
  filterFields: ['year', 'term', 'startDate', 'endDate', 'createdAt'],
  sortFields: ['year', 'term', 'startDate', 'endDate', 'createdAt'],
};

export async function academicPeriodRoutes(app: FastifyInstance) {
  const academicPeriodsService = new AcademicPeriodsService(
    new AcademicPeriodsRepository(app.db)
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(adminAnd('teacher', 'parent'))],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  app.get('/', readAccess, async (request, reply) => {
    const query = parseWithSchema(listAcademicPeriodsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      ACADEMIC_PERIOD_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return academicPeriodsService.listAcademicPeriods({
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:academicPeriodId', readAccess, async (request) => {
    const params = parseWithSchema(academicPeriodParamsSchema, request.params);

    return academicPeriodsService.getAcademicPeriod(params.academicPeriodId);
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createAcademicPeriodBodySchema, request.body);
    const result = await academicPeriodsService.createAcademicPeriod({
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/:academicPeriodId', adminOnly, async (request) => {
    const params = parseWithSchema(academicPeriodParamsSchema, request.params);
    const body = parseWithSchema(updateAcademicPeriodBodySchema, request.body);

    return academicPeriodsService.updateAcademicPeriod({
      academicPeriodId: params.academicPeriodId,
      ...body,
    });
  });

  app.delete('/:academicPeriodId', adminOnly, async (request) => {
    const params = parseWithSchema(academicPeriodParamsSchema, request.params);

    return academicPeriodsService.deleteAcademicPeriod(params.academicPeriodId);
  });
}
