import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  InstitutionsService,
  InstitutionsServiceError,
} from '../modules/institutions/application/institutions.service.js';
import { InstitutionsRepository } from '../modules/institutions/infrastructure/institutions.repository.js';
import {
  createInstitutionBodySchema,
  institutionParamsSchema,
  listInstitutionsQuerySchema,
  updateInstitutionBodySchema,
} from '../modules/institutions/schemas/institution.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new InstitutionsServiceError(
        firstIssue?.message ?? 'Invalid request',
        400
      );
    }

    throw error;
  }
}

function getUserInstitutionId(userInstitutionId: string | undefined) {
  if (!userInstitutionId) {
    throw new InstitutionsServiceError('Authentication is required', 401);
  }

  return userInstitutionId;
}

function assertInstitutionAccess(
  userInstitutionId: string | undefined,
  institutionId: string
) {
  if (getUserInstitutionId(userInstitutionId) !== institutionId) {
    throw new InstitutionsServiceError('Institution access denied', 403);
  }
}

export async function institutionRoutes(app: FastifyInstance) {
  const institutionsService = new InstitutionsService(
    new InstitutionsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/', adminOnly, async (request) => {
    const query = parseWithSchema(listInstitutionsQuerySchema, request.query);

    return institutionsService.listInstitutions({
      ...query,
      institutionId: getUserInstitutionId(request.user?.institutionId),
    });
  });

  app.get('/:institutionId', adminOnly, async (request) => {
    const params = parseWithSchema(institutionParamsSchema, request.params);
    assertInstitutionAccess(request.user?.institutionId, params.institutionId);

    return institutionsService.getInstitution(params.institutionId);
  });

  app.post('/', adminOnly, async (request, reply) => {
    parseWithSchema(createInstitutionBodySchema, request.body);
    return reply.status(403).send({
      message: 'Institution creation requires platform administrator access',
    });
  });

  app.patch('/:institutionId', adminOnly, async (request) => {
    const params = parseWithSchema(institutionParamsSchema, request.params);
    assertInstitutionAccess(request.user?.institutionId, params.institutionId);
    const body = parseWithSchema(updateInstitutionBodySchema, request.body);

    return institutionsService.updateInstitution({
      institutionId: params.institutionId,
      ...body,
    });
  });

  app.delete('/:institutionId', adminOnly, async (request) => {
    const params = parseWithSchema(institutionParamsSchema, request.params);
    assertInstitutionAccess(request.user?.institutionId, params.institutionId);

    throw new InstitutionsServiceError(
      'Institution deletion requires platform administrator access',
      403
    );
  });
}
