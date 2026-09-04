import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  GradesService,
  GradesServiceError,
  GradesRepository,
  createGradeBodySchema,
  gradeParamsSchema,
  institutionHeaderSchema,
  listGradesQuerySchema,
  updateGradeBodySchema,
} from '@edunic/source/domain/grades';

export async function gradeRoutes(app: FastifyInstance) {
  const gradesService = new GradesService(
    new GradesRepository(app.db),
    app.eventBus
  );
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const academicWriteAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher'])],
  };

  app.get('/', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listGradesQuerySchema, request.query);

    return gradesService.listGrades({
      institutionId,
      ...query,
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
      ...body,
    });
  });

  app.delete('/:gradeId', academicWriteAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(gradeParamsSchema, request.params);

    return gradesService.deleteGrade(institutionId, params.gradeId);
  });
}
