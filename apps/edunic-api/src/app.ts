import Fastify from 'fastify';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply
      .status(error.statusCode || 500)
      .send({ message: error.message || 'Internal Server Error' });
  });

  app.register

  return app;
}
