import type {
  CreateCustomFieldBody,
  CustomFieldType,
  ListCustomFieldsQuery,
  UpdateCustomFieldBody,
  UpsertCustomFieldValuesBody,
} from '../schemas/custom-field.schemas.js';
import {
  CustomFieldsRepository,
  type CustomFieldRecord,
  type CustomFieldValueRecord,
} from '../infrastructure/custom-fields.repository.js';

export class CustomFieldsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'CustomFieldsServiceError';
  }
}

export class CustomFieldsService {
  constructor(private readonly customFieldsRepository: CustomFieldsRepository) {}

  async listCustomFields(input: ListCustomFieldsQuery & { institutionId: string }) {
    const result = await this.customFieldsRepository.list({
      ...input,
      entity: input.entity?.trim() || undefined,
    });

    return {
      data: result.items.map((field) => this.toCustomFieldResponse(field)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async createCustomField(input: CreateCustomFieldBody & { institutionId: string }) {
    const field = await this.customFieldsRepository.create({
      institutionId: input.institutionId,
      entity: input.entity.trim(),
      name: input.name.trim(),
      type: input.type,
    });

    return {
      data: this.toCustomFieldResponse(field),
    };
  }

  async updateCustomField(
    input: UpdateCustomFieldBody & {
      institutionId: string;
      customFieldId: string;
    }
  ) {
    const existingField = await this.customFieldsRepository.findById(
      input.institutionId,
      input.customFieldId
    );

    if (!existingField) {
      throw new CustomFieldsServiceError('Custom field not found', 404);
    }

    const field = await this.customFieldsRepository.update({
      institutionId: input.institutionId,
      customFieldId: input.customFieldId,
      name: input.name?.trim(),
      type: input.type,
    });

    if (!field) {
      throw new CustomFieldsServiceError('Custom field not found', 404);
    }

    return {
      data: this.toCustomFieldResponse(field),
    };
  }

  async deleteCustomField(institutionId: string, customFieldId: string) {
    const existingField = await this.customFieldsRepository.findById(
      institutionId,
      customFieldId
    );

    if (!existingField) {
      throw new CustomFieldsServiceError('Custom field not found', 404);
    }

    const valueCount = await this.customFieldsRepository.countValues(customFieldId);

    if (valueCount > 0) {
      throw new CustomFieldsServiceError(
        'Custom field cannot be deleted while values exist',
        409
      );
    }

    await this.customFieldsRepository.delete(institutionId, customFieldId);

    return {
      data: {
        id: customFieldId,
        deleted: true,
      },
    };
  }

  async listCustomFieldValues(input: {
    institutionId: string;
    entity: string;
    entityId: string;
  }) {
    const values = await this.customFieldsRepository.listValues(input);

    return {
      data: values.map((value) => this.toCustomFieldValueResponse(value)),
    };
  }

  async upsertCustomFieldValues(
    input: UpsertCustomFieldValuesBody & {
      institutionId: string;
      entity: string;
      entityId: string;
    }
  ) {
    const fields = await this.customFieldsRepository.findManyByIds(
      input.institutionId,
      input.values.map((value) => value.fieldId)
    );
    const fieldsById = new Map(fields.map((field) => [field.id, field]));

    for (const value of input.values) {
      const field = fieldsById.get(value.fieldId);

      if (!field || field.entity !== input.entity) {
        throw new CustomFieldsServiceError('Custom field not found', 404);
      }

      this.assertValidFieldValue(field.type, value.value);
    }

    for (const value of input.values) {
      await this.customFieldsRepository.upsertValue({
        fieldId: value.fieldId,
        entityId: input.entityId,
        value: value.value,
      });
    }

    return this.listCustomFieldValues({
      institutionId: input.institutionId,
      entity: input.entity,
      entityId: input.entityId,
    });
  }

  private assertValidFieldValue(type: CustomFieldType, value: unknown) {
    if (value === null) {
      return;
    }

    if (type === 'text' || type === 'select') {
      if (typeof value !== 'string') {
        throw new CustomFieldsServiceError('Custom field value must be text', 400);
      }

      return;
    }

    if (type === 'number') {
      if (typeof value !== 'number') {
        throw new CustomFieldsServiceError('Custom field value must be a number', 400);
      }

      return;
    }

    if (type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new CustomFieldsServiceError('Custom field value must be a boolean', 400);
      }

      return;
    }

    if (
      type === 'date' &&
      (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
    ) {
      throw new CustomFieldsServiceError('Custom field value must be a date string', 400);
    }
  }

  private toCustomFieldResponse(field: CustomFieldRecord) {
    return {
      id: field.id,
      institutionId: field.institutionId,
      entity: field.entity,
      name: field.name,
      type: field.type,
    };
  }

  private toCustomFieldValueResponse(value: CustomFieldValueRecord) {
    return {
      id: value.id,
      fieldId: value.fieldId,
      entityId: value.entityId,
      value: value.value,
      field: {
        entity: value.fieldEntity,
        name: value.fieldName,
        type: value.fieldType,
      },
    };
  }
}
