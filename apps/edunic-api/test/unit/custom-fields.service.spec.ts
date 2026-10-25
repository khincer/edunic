import {
  CustomFieldsService,
  CustomFieldsServiceError,
} from '@edunic/source/domain/custom-fields';

describe('CustomFieldsService', () => {
  it('rejects values that do not match the custom field type', async () => {
    const repository = {
      findManyByIds: jest.fn().mockResolvedValue([
        {
          id: '00000000-0000-0000-0000-000000000001',
          entity: 'students',
          name: 'Scholarship',
          type: 'boolean',
        },
      ]),
    };
    const service = new CustomFieldsService(repository as never);

    await expect(
      service.upsertCustomFieldValues({
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

    expect(repository.findManyByIds).toHaveBeenCalledWith([
      '00000000-0000-0000-0000-000000000001',
    ]);
    expect(repository.listValues).toHaveBeenCalledWith({
      entity: 'students',
      entityId: '00000000-0000-0000-0000-000000000020',
    });
    expect(repository.upsertValue).toHaveBeenCalledWith({
      fieldId: '00000000-0000-0000-0000-000000000001',
      entityId: '00000000-0000-0000-0000-000000000020',
      value: true,
    });
  });

  it('looks fields up by id only and returns no institutionId', async () => {
    const field = {
      id: '00000000-0000-0000-0000-000000000001',
      entity: 'students',
      name: 'Scholarship',
      type: 'boolean',
    };
    const repository = {
      findById: jest.fn().mockResolvedValue(field),
      countValues: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue(field),
      update: jest.fn().mockResolvedValue(field),
    };
    const service = new CustomFieldsService(repository as never);

    const updated = await service.updateCustomField({
      customFieldId: field.id,
      name: ' Scholarship ',
    });
    await service.deleteCustomField(field.id);

    expect(updated.data).not.toHaveProperty('institutionId');
    expect(repository.findById).toHaveBeenCalledWith(field.id);
    expect(repository.update).toHaveBeenCalledWith({
      customFieldId: field.id,
      name: 'Scholarship',
      type: undefined,
    });
    expect(repository.delete).toHaveBeenCalledWith(field.id);
  });
});
