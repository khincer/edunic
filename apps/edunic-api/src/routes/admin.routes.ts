import type { FastifyInstance } from 'fastify';
import { BootstrapService } from '../modules/bootstrap/application/bootstrap.service.js';

export async function adminRoutes(app: FastifyInstance) {
  const bootstrapService = new BootstrapService();
  const adminOnly = {
    preHandler: [app.authenticate, app.authorizeRoles(['admin'])],
  };

  app.post('/bootstrap', adminOnly, async () => {
    return bootstrapService.runBootstrap();
  });
}
