import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  parseWithSchema,
  parseFilterSort,
} from '@edunic/source/domain/shared';
import {
  CustomFieldsService,
  CustomFieldsServiceError,
  CustomFieldsRepository,
  createCustomFieldBodySchema,
  customFieldParamsSchema,
  customFieldValuesParamsSchema,
  listCustomFieldsQuerySchema,
  updateCustomFieldBodySchema,
  upsertCustomFieldValuesBodySchema,
} from '@edunic/source/domain/custom-fields';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

const CUSTOM_FIELD_FILTER_SORT_OPTIONS = {
  filterFields: ['entity', 'name', 'type'],
  sortFields: ['entity', 'name', 'type'],
};

export async function customFieldRoutes(app: FastifyInstance) {
  const customFieldsService = new CustomFieldsService(
    new CustomFieldsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  app.get('/custom-fields', adminOnly, async (request, reply) => {
    const query = parseWithSchema(listCustomFieldsQuerySchema, request.query);
    const { filters, sort } = parseFilterSort(
      request.query as { filter?: string | string[]; sort?: string },
      CUSTOM_FIELD_FILTER_SORT_OPTIONS
    );

    if (!query.cursor) {
      reply.header('X-Pagination-Deprecated', 'offset');
    }

    return customFieldsService.listCustomFields({
      ...query,
      filters,
      sort,
    });
  });

  app.post('/custom-fields', adminOnly, async (request, reply) => {
    const body = parseWithSchema(createCustomFieldBodySchema, request.body);
    const result = await customFieldsService.createCustomField({
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/custom-fields/:customFieldId', adminOnly, async (request) => {
    const params = parseWithSchema(customFieldParamsSchema, request.params);
    const body = parseWithSchema(updateCustomFieldBodySchema, request.body);

    return customFieldsService.updateCustomField({
      customFieldId: params.customFieldId,
      ...body,
    });
  });

  app.delete('/custom-fields/:customFieldId', adminOnly, async (request) => {
    const params = parseWithSchema(customFieldParamsSchema, request.params);

    return customFieldsService.deleteCustomField(
      params.customFieldId
    );
  });

  app.get('/custom-fields/values/:entity/:entityId', adminOnly, async (request) => {
    const params = parseWithSchema(customFieldValuesParamsSchema, request.params);

    return customFieldsService.listCustomFieldValues({
      entity: params.entity,
      entityId: params.entityId,
    });
  });

  app.put('/custom-fields/values/:entity/:entityId', adminOnly, async (request) => {
    const params = parseWithSchema(customFieldValuesParamsSchema, request.params);
    const body = parseWithSchema(
      upsertCustomFieldValuesBodySchema,
      request.body
    );

    return customFieldsService.upsertCustomFieldValues({
      entity: params.entity,
      entityId: params.entityId,
      ...body,
    });
  });
}
