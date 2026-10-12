import Fastify from 'fastify';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
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

  await registerPlugins(app);
  await registerRoutes(app);

  return app;
}
