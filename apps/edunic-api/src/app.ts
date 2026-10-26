import Fastify, { type RouteOptions } from 'fastify';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';

export type BuildAppOptions = {
  // Called for every route as it is registered (the OpenAPI drift test lists
  // the routes with it).
  onRoute?: (route: RouteOptions) => void;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
    },
  });

  if (options.onRoute) {
    app.addHook('onRoute', options.onRoute);
  }

  await registerPlugins(app);
  await registerRoutes(app);

  return app;
}
