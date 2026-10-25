import type { FastifyInstance } from 'fastify';
import { BootstrapService } from '../modules/bootstrap/application/bootstrap.service.js';
import { ADMIN_ROLES } from '@edunic/source/domain/authorization';

export async function adminRoutes(app: FastifyInstance) {
  const bootstrapService = new BootstrapService();
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles([...ADMIN_ROLES])],
  };

  app.post('/bootstrap', adminOnly, async () => {
    return bootstrapService.runBootstrap();
  });
}
