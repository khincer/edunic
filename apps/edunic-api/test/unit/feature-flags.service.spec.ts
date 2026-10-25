import {
  FeatureFlagsService,
  FeatureFlagsServiceError,
} from '@edunic/source/domain/feature-flags';

describe('FeatureFlagsService', () => {
  it('allows enabled features', async () => {
    const repository = {
      findByKey: jest
        .fn()
        .mockResolvedValue({ key: 'teacher_gradebook', enabled: true }),
    };
    const service = new FeatureFlagsService(repository as never);

    await expect(
      service.requireEnabled('teacher_gradebook')
    ).resolves.toBeUndefined();
    expect(repository.findByKey).toHaveBeenCalledWith('teacher_gradebook');
  });

  it('returns 404 when a feature is disabled', async () => {
    const repository = {
      findByKey: jest
        .fn()
        .mockResolvedValue({ key: 'billing_module', enabled: false }),
    };
    const service = new FeatureFlagsService(repository as never);

    await expect(service.requireEnabled('billing_module')).rejects.toEqual(
      expect.objectContaining<Partial<FeatureFlagsServiceError>>({
        message: 'Feature is not available',
        statusCode: 404,
      })
    );
  });

  it('returns 404 when a feature does not exist', async () => {
    const repository = { findByKey: jest.fn().mockResolvedValue(null) };
    const service = new FeatureFlagsService(repository as never);

    await expect(service.requireEnabled('missing')).rejects.toEqual(
      expect.objectContaining<Partial<FeatureFlagsServiceError>>({
        statusCode: 404,
      })
    );
  });
});
