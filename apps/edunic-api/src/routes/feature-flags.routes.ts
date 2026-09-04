import type { FastifyInstance } from 'fastify';
import {
  FeatureFlagsService,
  FeatureFlagsServiceError,
  FeatureFlagsRepository,
  institutionFeatureFlagParamsSchema,
  institutionFeatureFlagsParamsSchema,
  updateInstitutionFeatureFlagBodySchema,
} from '@edunic/source/domain/feature-flags';
import { parseWithSchema } from '@edunic/source/domain/shared';

function assertInstitutionAccess(
  userInstitutionId: string | undefined,
  institutionId: string
) {
  if (userInstitutionId !== institutionId) {
    throw new FeatureFlagsServiceError('Institution access denied', 403);
  }
}

function getUserInstitutionId(userInstitutionId: string | undefined) {
  if (!userInstitutionId) {
    throw new FeatureFlagsServiceError('Authentication is required', 401);
  }

  return userInstitutionId;
}

export async function featureFlagRoutes(app: FastifyInstance) {
  const featureFlagsService = new FeatureFlagsService(
    new FeatureFlagsRepository(app.db)
  );
  const authenticated = {
    preHandler: [app.authenticate],
  };
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.get('/feature-flags', authenticated, async (request) => {
    return featureFlagsService.listEffectiveFlags(
      getUserInstitutionId(request.user?.institutionId)
    );
  });

  app.get(
    '/institutions/:institutionId/feature-flags',
    adminOnly,
    async (request) => {
      const params = parseWithSchema(
        institutionFeatureFlagsParamsSchema,
        request.params
      );
      assertInstitutionAccess(request.user?.institutionId, params.institutionId);

      return featureFlagsService.listEffectiveFlags(params.institutionId);
    }
  );

  app.put(
    '/institutions/:institutionId/feature-flags/:featureKey',
    adminOnly,
    async (request) => {
      const params = parseWithSchema(
        institutionFeatureFlagParamsSchema,
        request.params
      );
      const body = parseWithSchema(
        updateInstitutionFeatureFlagBodySchema,
        request.body
      );
      assertInstitutionAccess(request.user?.institutionId, params.institutionId);

      return featureFlagsService.setInstitutionFlag({
        institutionId: params.institutionId,
        featureKey: params.featureKey,
        ...body,
      });
    }
  );

  app.delete(
    '/institutions/:institutionId/feature-flags/:featureKey',
    adminOnly,
    async (request) => {
      const params = parseWithSchema(
        institutionFeatureFlagParamsSchema,
        request.params
      );
      assertInstitutionAccess(request.user?.institutionId, params.institutionId);

      return featureFlagsService.resetInstitutionFlag(
        params.institutionId,
        params.featureKey
      );
    }
  );
}
