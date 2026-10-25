import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type FeatureFlagRecord = {
  key: string;
  enabled: boolean;
};

// Flags are global: a single school has no per-school override layer, so the
// flag value is `feature_flags.default_value`.
export class FeatureFlagsRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async list() {
    const result = await this.db.execute<FeatureFlagRecord>(sql`
      select key, default_value as enabled
      from feature_flags
      order by key asc
    `);

    return result.rows;
  }

  async findByKey(featureKey: string) {
    const result = await this.db.execute<FeatureFlagRecord>(sql`
      select key, default_value as enabled
      from feature_flags
      where key = ${featureKey}
      limit 1
    `);

    return result.rows[0] ?? null;
  }

  async setEnabled(featureKey: string, enabled: boolean) {
    const result = await this.db.execute<FeatureFlagRecord>(sql`
      update feature_flags
      set default_value = ${enabled}
      where key = ${featureKey}
      returning key, default_value as enabled
    `);

    return result.rows[0] ?? null;
  }
}
