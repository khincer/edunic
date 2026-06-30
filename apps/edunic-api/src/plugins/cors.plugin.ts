import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

const ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  'x-institution-id',
  'x-request-id',
].join(', ');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].join(', ');

export const corsPlugin = fp(async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    applyCorsHeaders(request, reply);

    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }

    return undefined;
  });
});

function applyCorsHeaders(request: FastifyRequest, reply: FastifyReply) {
  const origin = request.headers.origin;

  reply.header('Vary', 'Origin');

  if (!origin || !isAllowedOrigin(origin)) {
    return;
  }

  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
  reply.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  reply.header('Access-Control-Max-Age', '86400');

  if (env.CORS_ALLOW_CREDENTIALS) {
    reply.header('Access-Control-Allow-Credentials', 'true');
  }
}

function isAllowedOrigin(origin: string) {
  return env.CORS_ORIGINS.some((allowedOrigin) => {
    if (allowedOrigin === origin) {
      return true;
    }

    if (!allowedOrigin.includes('*')) {
      return false;
    }

    const pattern = allowedOrigin
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^:/]+');

    return new RegExp(`^${pattern}$`).test(origin);
  });
}
