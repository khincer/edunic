import type { FastifyInstance } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  InstitutionsService,
  InstitutionsServiceError,
  InstitutionsRepository,
  createInstitutionBodySchema,
  institutionParamsSchema,
  listInstitutionsQuerySchema,
  updateInstitutionBodySchema,
} from '@edunic/source/domain/institutions';

const INSTITUTION_FILTER_SORT_OPTIONS = {
  filterFields: ['name', 'createdAt'],
  sortFields: ['name', 'createdAt'],
};

// SI-R2: an institution admin may only write its own institution. Mirrors
// `assertInstitutionAccess` in feature-flags.routes.ts. This covers the whole
// PATCH endpoint, not only the sender identity fields.
function assertInstitutionAccess(
  userInstitutionId: string | undefined,
  institutionId: string
) {
  if (userInstitutionId !== institutionId) {
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

  app.get('/', adminOnly, async (request, reply) => {
    const query = parseWithSchema(listInstitutionsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      INSTITUTION_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return institutionsService.listInstitutions({
      ...query,
      filters,
      sort,
    });
  });

  app.get('/:institutionId', adminOnly, async (request) => {
    const params = parseWithSchema(institutionParamsSchema, request.params);

    return institutionsService.getInstitution(params.institutionId);
  });

  app.post('/', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createInstitutionBodySchema, request.body);
    const result = await institutionsService.createInstitution(body);

    return reply.status(201).send(result);
  });

  app.patch('/:institutionId', adminOnly, async (request) => {
    const params = parseWithSchema(institutionParamsSchema, request.params);
    const body = parseWithSchema(updateInstitutionBodySchema, request.body);
    assertInstitutionAccess(request.user?.institutionId, params.institutionId);

    return institutionsService.updateInstitution({
      institutionId: params.institutionId,
      ...body,
    });
  });

  app.delete('/:institutionId', adminOnly, async (request) => {
    const params = parseWithSchema(institutionParamsSchema, request.params);

    return institutionsService.deleteInstitution(params.institutionId);
  });
}
