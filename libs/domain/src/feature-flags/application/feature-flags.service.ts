import type { UpdateInstitutionFeatureFlagBody } from '../schemas/feature-flag.schemas.js';
import {
  FeatureFlagsRepository,
  type EffectiveFeatureFlagRecord,
} from '../infrastructure/feature-flags.repository.js';

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

  async listEffectiveFlags(institutionId: string) {
    const flags = await this.featureFlagsRepository.listEffective(institutionId);

    return {
      data: flags.map((flag) => this.toFeatureFlagResponse(flag)),
    };
  }

  async setInstitutionFlag(
    input: UpdateInstitutionFeatureFlagBody & {
      institutionId: string;
      featureKey: string;
    }
  ) {
    await this.assertFeatureFlagExists(input.featureKey);

    const flag = await this.featureFlagsRepository.upsertInstitutionFlag({
      institutionId: input.institutionId,
      featureKey: input.featureKey,
      enabled: input.enabled,
    });

    if (!flag) {
      throw new FeatureFlagsServiceError('Feature flag not found', 404);
    }

    return {
      data: this.toFeatureFlagResponse(flag),
    };
  }

  async resetInstitutionFlag(institutionId: string, featureKey: string) {
    await this.assertFeatureFlagExists(featureKey);

    const flag = await this.featureFlagsRepository.deleteInstitutionFlag(
      institutionId,
      featureKey
    );

    if (!flag) {
      throw new FeatureFlagsServiceError('Feature flag not found', 404);
    }

    return {
      data: this.toFeatureFlagResponse(flag),
    };
  }

  async requireEnabled(institutionId: string, featureKey: string) {
    const flag = await this.featureFlagsRepository.findEffective(
      institutionId,
      featureKey
    );

    if (!flag?.enabled) {
      throw new FeatureFlagsServiceError('Feature is not available', 404);
    }
  }

  private async assertFeatureFlagExists(featureKey: string) {
    const flag = await this.featureFlagsRepository.findByKey(featureKey);

    if (!flag) {
      throw new FeatureFlagsServiceError('Feature flag not found', 404);
    }
  }

  private toFeatureFlagResponse(flag: EffectiveFeatureFlagRecord) {
    return {
      key: flag.key,
      defaultValue: flag.defaultValue,
      institutionEnabled: flag.institutionEnabled,
      enabled: flag.enabled,
      source: flag.institutionEnabled === null ? 'default' : 'institution',
    };
  }
}
