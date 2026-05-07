import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  ExtensionsService,
  ExtensionsServiceError,
} from '../modules/extensions/application/extensions.service.js';
import { ExtensionsRepository } from '../modules/extensions/infrastructure/extensions.repository.js';
import {
  createExtensionBodySchema,
  extensionParamsSchema,
  institutionExtensionParamsSchema,
  institutionExtensionsParamsSchema,
  listExtensionsQuerySchema,
  updateExtensionBodySchema,
  upsertInstitutionExtensionBodySchema,
} from '../modules/extensions/schemas/extension.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new ExtensionsServiceError(
        firstIssue?.message ?? 'Invalid request',
        400
      );
    }

    throw error;
  }
}

export async function extensionRoutes(app: FastifyInstance) {
  const extensionsService = new ExtensionsService(
    new ExtensionsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/extensions', adminOnly, async (request) => {
    const query = parseWithSchema(listExtensionsQuerySchema, request.query);

    return extensionsService.listExtensions(query);
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
