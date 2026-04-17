import { registerRoutes } from './routes/index.js';
import fastifyModule from 'fastify';

type ApiLogger = {
  error(error: unknown): void;
};

type ApiRequest = {
  log: ApiLogger;
};

type ApiReply = {
  status(code: number): {
    send(payload: { message: string }): void;
  };
};

type ApiApp = {
  get(path: string, handler: () => unknown | Promise<unknown>): void;
  register(plugin: (app: ApiApp) => void | Promise<void>, options: { prefix: string }): void;
  setErrorHandler(handler: (error: { statusCode?: number; message?: string }, request: ApiRequest, reply: ApiReply) => void): void;
  listen(options: { port: number; host: string }): Promise<void>;
  log: ApiLogger;
};

type FastifyFactory = (options?: {
  logger?: {
    level?: string;
    transport?: {
      target: string;
      options: {
        colorize: boolean;
      };
    };
  };
}) => ApiApp;

export async function buildApp() {
  const fastify = fastifyModule as unknown as FastifyFactory;

  const app = fastify({
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

  app.setErrorHandler((error: { statusCode?: number; message?: string }, request: ApiRequest, reply: ApiReply) => {
    request.log.error(error);

    reply.status(error.statusCode || 500).send({
      message: error.message || 'Internal Server Error',
    });
  });

  await registerRoutes(app);

  return app;
}
