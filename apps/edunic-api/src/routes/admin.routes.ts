import type { FastifyInstance } from 'fastify';
import { BootstrapService } from '../modules/bootstrap/application/bootstrap.service.js';

export async function adminRoutes(app: FastifyInstance) {
  const bootstrapService = new BootstrapService();
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['director', 'vice_director', 'subdirector'])],
  };

  app.post('/bootstrap', adminOnly, async () => {
    return bootstrapService.runBootstrap();
  });
}
