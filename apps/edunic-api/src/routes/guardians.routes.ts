import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId, parseFilterSort } from '@edunic/source/domain/shared';
import {
  GuardiansService,
  GuardiansServiceError,
  GuardiansRepository,
  createGuardianBodySchema,
  guardianParamsSchema,
  listGuardiansQuerySchema,
  studentGuardianParamsSchema,
  studentGuardiansParamsSchema,
  updateGuardianBodySchema,
} from '@edunic/source/domain/guardians';

const GUARDIAN_FILTER_SORT_OPTIONS = {
  filterFields: ['name', 'phone'],
  sortFields: ['name', 'phone'],
};

export async function guardianRoutes(app: FastifyInstance) {
  const guardiansService = new GuardiansService(new GuardiansRepository(app.db));
  const readAccess = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin', 'teacher', 'parent'])],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/guardians', readAccess, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listGuardiansQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      GUARDIAN_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return guardiansService.listGuardians({
      institutionId,
      ...query,
      filters,
      sort,
    });
  });

  app.get('/guardians/:guardianId', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(guardianParamsSchema, request.params);

    return guardiansService.getGuardian(institutionId, params.guardianId);
  });

  app.post('/guardians', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createGuardianBodySchema, request.body);
    const result = await guardiansService.createGuardian({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/guardians/:guardianId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(guardianParamsSchema, request.params);
    const body = parseWithSchema(updateGuardianBodySchema, request.body);

    return guardiansService.updateGuardian({
      institutionId,
      guardianId: params.guardianId,
      ...body,
    });
  });

  app.delete('/guardians/:guardianId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(guardianParamsSchema, request.params);

    return guardiansService.deleteGuardian(institutionId, params.guardianId);
  });

  app.get('/students/:studentId/guardians', readAccess, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentGuardiansParamsSchema, request.params);

    return guardiansService.listStudentGuardians(
      institutionId,
      params.studentId
    );
  });

  app.post('/students/:studentId/guardians/:guardianId', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentGuardianParamsSchema, request.params);
    const result = await guardiansService.linkGuardianToStudent(
      institutionId,
      params.studentId,
      params.guardianId
    );

    return reply.status(201).send(result);
  });

  app.delete('/students/:studentId/guardians/:guardianId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentGuardianParamsSchema, request.params);

    return guardiansService.unlinkGuardianFromStudent(
      institutionId,
      params.studentId,
      params.guardianId
    );
  });
}
