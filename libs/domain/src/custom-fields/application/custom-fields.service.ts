import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
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

  async listCustomFields(
    input: ListCustomFieldsQuery & {
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.customFieldsRepository.list({
      ...input,
      entity: input.entity?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (field) => field.entity,
        id: (field) => field.id,
      },
      result.total
    );

    return {
      data: page.data.map((field) => this.toCustomFieldResponse(field)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async createCustomField(input: CreateCustomFieldBody) {
    const field = await this.customFieldsRepository.create({
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
      customFieldId: string;
    }
  ) {
    const existingField = await this.customFieldsRepository.findById(input.customFieldId);

    if (!existingField) {
      throw new CustomFieldsServiceError('Custom field not found', 404);
    }

    const field = await this.customFieldsRepository.update({
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

  async deleteCustomField(customFieldId: string) {
    const existingField =
      await this.customFieldsRepository.findById(customFieldId);

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

    await this.customFieldsRepository.delete(customFieldId);

    return {
      data: {
        id: customFieldId,
        deleted: true,
      },
    };
  }

  async listCustomFieldValues(input: {
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
      entity: string;
      entityId: string;
    }
  ) {
    const fields = await this.customFieldsRepository.findManyByIds(
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
