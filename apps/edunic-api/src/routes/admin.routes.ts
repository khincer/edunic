import type { FastifyInstance } from 'fastify';
import { BootstrapService } from '../modules/bootstrap/application/bootstrap.service.js';

export async function adminRoutes(app: FastifyInstance) {
  const bootstrapService = new BootstrapService();

  app.post('/bootstrap', async () => {
    return bootstrapService.runBootstrap();
  });
}
