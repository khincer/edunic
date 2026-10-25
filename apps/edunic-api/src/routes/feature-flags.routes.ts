import type { FastifyInstance } from 'fastify';
import {
  FeatureFlagsService,
  FeatureFlagsRepository,
  featureFlagParamsSchema,
  updateFeatureFlagBodySchema,
} from '@edunic/source/domain/feature-flags';
import { parseWithSchema } from '@edunic/source/domain/shared';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

export async function featureFlagRoutes(app: FastifyInstance) {
  const featureFlagsService = new FeatureFlagsService(
    new FeatureFlagsRepository(app.db)
  );

  app.get(
    '/feature-flags',
    { preHandler: [app.authenticate] },
    async () => featureFlagsService.listFlags()
  );

  app.patch(
    '/feature-flags/:featureKey',
    { preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])] },
    async (request) => {
      const params = parseWithSchema(featureFlagParamsSchema, request.params);
      const body = parseWithSchema(updateFeatureFlagBodySchema, request.body);

      return featureFlagsService.setFlag({
        featureKey: params.featureKey,
        ...body,
      });
    }
  );
}
