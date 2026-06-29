import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

type Database = FastifyInstance['db'];

export type EffectiveFeatureFlagRecord = {
  key: string;
  defaultValue: boolean;
  institutionEnabled: boolean | null;
  enabled: boolean;
};

export type FeatureFlagRecord = {
  key: string;
  defaultValue: boolean;
};

export class FeatureFlagsRepository {
  constructor(private readonly db: Database) {}

  async listEffective(institutionId: string) {
    const result = await this.db.execute<EffectiveFeatureFlagRecord>(sql`
      select
        feature_flags.key,
        feature_flags.default_value as "defaultValue",
        institution_feature_flags.enabled as "institutionEnabled",
        coalesce(
          institution_feature_flags.enabled,
          feature_flags.default_value
        ) as enabled
      from feature_flags
      left join institution_feature_flags
        on institution_feature_flags.feature_key = feature_flags.key
       and institution_feature_flags.institution_id = ${institutionId}
      order by feature_flags.key asc
    `);

    return result.rows;
  }

  async findByKey(featureKey: string) {
    const result = await this.db.execute<FeatureFlagRecord>(sql`
      select
        key,
        default_value as "defaultValue"
      from feature_flags
      where key = ${featureKey}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async findEffective(institutionId: string, featureKey: string) {
    const result = await this.db.execute<EffectiveFeatureFlagRecord>(sql`
      select
        feature_flags.key,
        feature_flags.default_value as "defaultValue",
        institution_feature_flags.enabled as "institutionEnabled",
        coalesce(
          institution_feature_flags.enabled,
          feature_flags.default_value
        ) as enabled
      from feature_flags
      left join institution_feature_flags
        on institution_feature_flags.feature_key = feature_flags.key
       and institution_feature_flags.institution_id = ${institutionId}
      where feature_flags.key = ${featureKey}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async upsertInstitutionFlag(input: {
    institutionId: string;
    featureKey: string;
    enabled: boolean;
  }) {
    await this.db.execute(sql`
      insert into institution_feature_flags (
        institution_id,
        feature_key,
        enabled
      )
      values (
        ${input.institutionId},
        ${input.featureKey},
        ${input.enabled}
      )
      on conflict (institution_id, feature_key)
      do update set enabled = excluded.enabled
    `);

    return this.findEffective(input.institutionId, input.featureKey);
  }

  async deleteInstitutionFlag(institutionId: string, featureKey: string) {
    await this.db.execute(sql`
      delete from institution_feature_flags
      where institution_id = ${institutionId}
        and feature_key = ${featureKey}
    `);

    return this.findEffective(institutionId, featureKey);
  }
}
