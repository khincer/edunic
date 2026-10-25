import type { FastifyInstance } from 'fastify';
import {
  InstitutionsService,
  InstitutionsRepository,
  updateInstitutionBodySchema,
} from '@edunic/source/domain/institutions';
import { parseWithSchema } from '@edunic/source/domain/shared';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

// The school is a single record: its name and the sender identity of the
// outbound email. There is no list and no delete — one school, and deleting
// it would leave the platform with none.
export async function schoolProfileRoutes(app: FastifyInstance) {
  const institutionsService = new InstitutionsService(
    new InstitutionsRepository(app.db)
  );
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  app.get('/', adminOnly, async () => {
    return institutionsService.getSchoolProfile();
  });

  app.patch('/', adminOnly, async (request) => {
    const body = parseWithSchema(updateInstitutionBodySchema, request.body);

    return institutionsService.updateSchoolProfile(body);
  });
}
