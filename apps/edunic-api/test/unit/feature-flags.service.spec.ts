import {
  FeatureFlagsService,
  FeatureFlagsServiceError,
} from '../../src/modules/feature-flags/application/feature-flags.service.js';

describe('FeatureFlagsService', () => {
  it('allows enabled features', async () => {
    const repository = {
      findEffective: jest.fn().mockResolvedValue({
        key: 'teacher_gradebook',
        defaultValue: true,
        institutionEnabled: null,
        enabled: true,
      }),
    };
    const service = new FeatureFlagsService(repository as never);

    await expect(
      service.requireEnabled('inst-1', 'teacher_gradebook')
    ).resolves.toBeUndefined();
  });

  it('returns 404 when a feature is disabled or missing', async () => {
    const repository = {
      findEffective: jest.fn().mockResolvedValue({
        key: 'billing_module',
        defaultValue: false,
        institutionEnabled: null,
        enabled: false,
      }),
    };
    const service = new FeatureFlagsService(repository as never);

    await expect(
      service.requireEnabled('inst-1', 'billing_module')
    ).rejects.toEqual(
      expect.objectContaining<Partial<FeatureFlagsServiceError>>({
        message: 'Feature is not available',
        statusCode: 404,
      })
    );
  });
});
