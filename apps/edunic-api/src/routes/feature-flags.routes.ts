import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import {
  FeatureFlagsService,
  FeatureFlagsServiceError,
} from '../modules/feature-flags/application/feature-flags.service.js';
import { FeatureFlagsRepository } from '../modules/feature-flags/infrastructure/feature-flags.repository.js';
import {
  institutionFeatureFlagParamsSchema,
  institutionFeatureFlagsParamsSchema,
  updateInstitutionFeatureFlagBodySchema,
} from '../modules/feature-flags/schemas/feature-flag.schemas.js';

function parseWithSchema<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      throw new FeatureFlagsServiceError(
        firstIssue?.message ?? 'Invalid request',
        400
      );
    }

    throw error;
  }
}

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
