import {
  CustomFieldsService,
  CustomFieldsServiceError,
} from '../../src/modules/custom-fields/application/custom-fields.service.js';

describe('CustomFieldsService', () => {
  it('rejects values that do not match the custom field type', async () => {
    const repository = {
      findManyByIds: jest.fn().mockResolvedValue([
        {
          id: '00000000-0000-0000-0000-000000000001',
          institutionId: '00000000-0000-0000-0000-000000000010',
          entity: 'students',
          name: 'Scholarship',
          type: 'boolean',
        },
      ]),
    };
    const service = new CustomFieldsService(repository as never);

    await expect(
      service.upsertCustomFieldValues({
        institutionId: '00000000-0000-0000-0000-000000000010',
        entity: 'students',
        entityId: '00000000-0000-0000-0000-000000000020',
        values: [
          {
            fieldId: '00000000-0000-0000-0000-000000000001',
            value: 'yes',
          },
        ],
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<CustomFieldsServiceError>>({
        message: 'Custom field value must be a boolean',
        statusCode: 400,
      })
    );
  });

  it('upserts valid custom field values', async () => {
    const repository = {
      findManyByIds: jest.fn().mockResolvedValue([
        {
          id: '00000000-0000-0000-0000-000000000001',
          institutionId: '00000000-0000-0000-0000-000000000010',
          entity: 'students',
          name: 'Scholarship',
          type: 'boolean',
        },
      ]),
      upsertValue: jest.fn().mockResolvedValue(undefined),
      listValues: jest.fn().mockResolvedValue([]),
    };
    const service = new CustomFieldsService(repository as never);

    await service.upsertCustomFieldValues({
      institutionId: '00000000-0000-0000-0000-000000000010',
      entity: 'students',
      entityId: '00000000-0000-0000-0000-000000000020',
      values: [
        {
          fieldId: '00000000-0000-0000-0000-000000000001',
          value: true,
        },
      ],
    });

    expect(repository.upsertValue).toHaveBeenCalledWith({
      fieldId: '00000000-0000-0000-0000-000000000001',
      entityId: '00000000-0000-0000-0000-000000000020',
      value: true,
    });
  });
});
