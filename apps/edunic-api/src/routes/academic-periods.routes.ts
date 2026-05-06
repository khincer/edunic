import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  AcademicPeriodsService,
  AcademicPeriodsServiceError,
} from '../modules/academic-periods/application/academic-periods.service.js';
import { AcademicPeriodsRepository } from '../modules/academic-periods/infrastructure/academic-periods.repository.js';
import {
  academicPeriodParamsSchema,
  createAcademicPeriodBodySchema,
  institutionHeaderSchema,
  listAcademicPeriodsQuerySchema,
  updateAcademicPeriodBodySchema,
} from '../modules/academic-periods/schemas/academic-period.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new AcademicPeriodsServiceError(
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

  app.get('/', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listAcademicPeriodsQuerySchema, request.query);

    return academicPeriodsService.listAcademicPeriods({
      institutionId,
      ...query,
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
