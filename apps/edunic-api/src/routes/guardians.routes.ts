import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import {
  GuardiansService,
  GuardiansServiceError,
} from '../modules/guardians/application/guardians.service.js';
import { GuardiansRepository } from '../modules/guardians/infrastructure/guardians.repository.js';
import {
  createGuardianBodySchema,
  guardianParamsSchema,
  institutionHeaderSchema,
  listGuardiansQuerySchema,
  studentGuardianParamsSchema,
  studentGuardiansParamsSchema,
  updateGuardianBodySchema,
} from '../modules/guardians/schemas/guardian.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new GuardiansServiceError(
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

export async function guardianRoutes(app: FastifyInstance) {
  const guardiansService = new GuardiansService(new GuardiansRepository(app.db));

  app.get('/guardians', async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listGuardiansQuerySchema, request.query);

    return guardiansService.listGuardians({
      institutionId,
      ...query,
    });
  });

  app.get('/guardians/:guardianId', async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(guardianParamsSchema, request.params);

    return guardiansService.getGuardian(institutionId, params.guardianId);
  });

  app.post('/guardians', async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createGuardianBodySchema, request.body);
    const result = await guardiansService.createGuardian({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/guardians/:guardianId', async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(guardianParamsSchema, request.params);
    const body = parseWithSchema(updateGuardianBodySchema, request.body);

    return guardiansService.updateGuardian({
      institutionId,
      guardianId: params.guardianId,
      ...body,
    });
  });

  app.delete('/guardians/:guardianId', async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(guardianParamsSchema, request.params);

    return guardiansService.deleteGuardian(institutionId, params.guardianId);
  });

  app.get('/students/:studentId/guardians', async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentGuardiansParamsSchema, request.params);

    return guardiansService.listStudentGuardians(
      institutionId,
      params.studentId
    );
  });

  app.post('/students/:studentId/guardians/:guardianId', async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentGuardianParamsSchema, request.params);
    const result = await guardiansService.linkGuardianToStudent(
      institutionId,
      params.studentId,
      params.guardianId
    );

    return reply.status(201).send(result);
  });

  app.delete('/students/:studentId/guardians/:guardianId', async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(studentGuardianParamsSchema, request.params);

    return guardiansService.unlinkGuardianFromStudent(
      institutionId,
      params.studentId,
      params.guardianId
    );
  });
}
