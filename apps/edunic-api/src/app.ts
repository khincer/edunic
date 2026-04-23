import Fastify, {
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
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

  app.setErrorHandler((error: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error(error);

    reply.status(error.statusCode || 500).send({
      message: error.message || 'Internal Server Error',
    });
  });

  await registerPlugins(app);
  await registerRoutes(app);

  return app;
}
