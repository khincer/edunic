import type { FastifyInstance } from 'fastify';
import {
  ExtensionsService,
  ExtensionsServiceError,
  ExtensionsRepository,
  createExtensionBodySchema,
  extensionParamsSchema,
  institutionExtensionParamsSchema,
  institutionExtensionsParamsSchema,
  listExtensionsQuerySchema,
  updateExtensionBodySchema,
  upsertInstitutionExtensionBodySchema,
} from '@edunic/source/domain/extensions';
import { parseWithSchema, parseFilterSort } from '@edunic/source/domain/shared';

const EXTENSION_FILTER_SORT_OPTIONS = {
  filterFields: ['key', 'name'],
  sortFields: ['key', 'name'],
};

export async function extensionRoutes(app: FastifyInstance) {
  const extensionsService = new ExtensionsService(
    new ExtensionsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/extensions', adminOnly, async (request, reply) => {
    const query = parseWithSchema(listExtensionsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      EXTENSION_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return extensionsService.listExtensions({ ...query, filters, sort });
  });

  app.post('/extensions', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createExtensionBodySchema, request.body);
    const result = await extensionsService.createExtension(body);

    return reply.status(201).send(result);
  });

  app.patch('/extensions/:extensionKey', adminOnly, async (request) => {
    const params = parseWithSchema(extensionParamsSchema, request.params);
    const body = parseWithSchema(updateExtensionBodySchema, request.body);

    return extensionsService.updateExtension({
      extensionKey: params.extensionKey,
      ...body,
    });
  });

  app.get('/institutions/:institutionId/extensions', adminOnly, async (request) => {
    const params = parseWithSchema(
      institutionExtensionsParamsSchema,
      request.params
    );

    return extensionsService.listInstitutionExtensions(params.institutionId);
  });

  app.put('/institutions/:institutionId/extensions/:extensionKey', adminOnly, async (request) => {
    const params = parseWithSchema(
      institutionExtensionParamsSchema,
      request.params
    );
    const body = parseWithSchema(
      upsertInstitutionExtensionBodySchema,
      request.body
    );

    return extensionsService.upsertInstitutionExtension({
      institutionId: params.institutionId,
      extensionKey: params.extensionKey,
      ...body,
    });
  });

  app.delete('/institutions/:institutionId/extensions/:extensionKey', adminOnly, async (request) => {
    const params = parseWithSchema(
      institutionExtensionParamsSchema,
      request.params
    );

    return extensionsService.deleteInstitutionExtension(
      params.institutionId,
      params.extensionKey
    );
  });
}
