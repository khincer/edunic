import type { UpdateFeatureFlagBody } from '../schemas/feature-flag.schemas.js';
import { FeatureFlagsRepository } from '../infrastructure/feature-flags.repository.js';

export class FeatureFlagsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'FeatureFlagsServiceError';
  }
}

export class FeatureFlagsService {
  constructor(private readonly featureFlagsRepository: FeatureFlagsRepository) {}

  async listFlags() {
    return { data: await this.featureFlagsRepository.list() };
  }

  async setFlag(input: UpdateFeatureFlagBody & { featureKey: string }) {
    const flag = await this.featureFlagsRepository.setEnabled(
      input.featureKey,
      input.enabled
    );

    if (!flag) {
      throw new FeatureFlagsServiceError('Feature flag not found', 404);
    }

    return { data: flag };
  }

  async requireEnabled(featureKey: string) {
    const flag = await this.featureFlagsRepository.findByKey(featureKey);

    if (!flag?.enabled) {
      throw new FeatureFlagsServiceError('Feature is not available', 404);
    }
  }
}
