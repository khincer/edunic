import { healthRoutes } from './health.routes.js';

type ApiApp = {
  get(path: string, handler: () => unknown | Promise<unknown>): void;
  register(plugin: (app: ApiApp) => void | Promise<void>, options: { prefix: string }): void;
};

export async function registerRoutes(app: ApiApp) {
  app.register(healthRoutes, { prefix: '/health' });
}
