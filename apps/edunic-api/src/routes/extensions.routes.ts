import type { FastifyInstance } from 'fastify';
import {
  ExtensionsService,
  ExtensionsRepository,
  createExtensionBodySchema,
  extensionParamsSchema,
  listExtensionsQuerySchema,
  updateExtensionBodySchema,
  setExtensionConfigBodySchema,
} from '@edunic/source/domain/extensions';
import { parseWithSchema, parseFilterSort } from '@edunic/source/domain/shared';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

const EXTENSION_FILTER_SORT_OPTIONS = {
  filterFields: ['key', 'name'],
  sortFields: ['key', 'name'],
};

export async function extensionRoutes(app: FastifyInstance) {
  const extensionsService = new ExtensionsService(
    new ExtensionsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
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

  app.put('/extensions/:extensionKey/config', adminOnly, async (request) => {
    const params = parseWithSchema(extensionParamsSchema, request.params);
    const body = parseWithSchema(setExtensionConfigBodySchema, request.body ?? {});

    return extensionsService.setConfig({
      extensionKey: params.extensionKey,
      ...body,
    });
  });

  app.delete('/extensions/:extensionKey/config', adminOnly, async (request) => {
    const params = parseWithSchema(extensionParamsSchema, request.params);

    return extensionsService.clearConfig(params.extensionKey);
  });
}
