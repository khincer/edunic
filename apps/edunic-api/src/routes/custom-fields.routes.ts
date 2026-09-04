import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWithSchema, getInstitutionId } from '@edunic/source/domain/shared';
import {
  CustomFieldsService,
  CustomFieldsServiceError,
} from '../modules/custom-fields/application/custom-fields.service.js';
import { CustomFieldsRepository } from '../modules/custom-fields/infrastructure/custom-fields.repository.js';
import {
  createCustomFieldBodySchema,
  customFieldParamsSchema,
  customFieldValuesParamsSchema,
  institutionHeaderSchema,
  listCustomFieldsQuerySchema,
  updateCustomFieldBodySchema,
  upsertCustomFieldValuesBodySchema,
} from '../modules/custom-fields/schemas/custom-field.schemas.js';

export async function customFieldRoutes(app: FastifyInstance) {
  const customFieldsService = new CustomFieldsService(
    new CustomFieldsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/custom-fields', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const query = parseWithSchema(listCustomFieldsQuerySchema, request.query);

    return customFieldsService.listCustomFields({
      institutionId,
      ...query,
    });
  });

  app.post('/custom-fields', adminOnly, async (request, reply) => {
    const institutionId = getInstitutionId(request);
    const body = parseWithSchema(createCustomFieldBodySchema, request.body);
    const result = await customFieldsService.createCustomField({
      institutionId,
      ...body,
    });

    return reply.status(201).send(result);
  });

  app.patch('/custom-fields/:customFieldId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(customFieldParamsSchema, request.params);
    const body = parseWithSchema(updateCustomFieldBodySchema, request.body);

    return customFieldsService.updateCustomField({
      institutionId,
      customFieldId: params.customFieldId,
      ...body,
    });
  });

  app.delete('/custom-fields/:customFieldId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(customFieldParamsSchema, request.params);

    return customFieldsService.deleteCustomField(
      institutionId,
      params.customFieldId
    );
  });

  app.get('/custom-fields/values/:entity/:entityId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(customFieldValuesParamsSchema, request.params);

    return customFieldsService.listCustomFieldValues({
      institutionId,
      entity: params.entity,
      entityId: params.entityId,
    });
  });

  app.put('/custom-fields/values/:entity/:entityId', adminOnly, async (request) => {
    const institutionId = getInstitutionId(request);
    const params = parseWithSchema(customFieldValuesParamsSchema, request.params);
    const body = parseWithSchema(
      upsertCustomFieldValuesBodySchema,
      request.body
    );

    return customFieldsService.upsertCustomFieldValues({
      institutionId,
      entity: params.entity,
      entityId: params.entityId,
      ...body,
    });
  });
}
