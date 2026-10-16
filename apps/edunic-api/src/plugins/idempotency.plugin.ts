import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import {
  buildIdempotencyKey,
  createErrorEnvelope,
  lookupIdempotency,
  releaseIdempotencyKey,
  storeIdempotentResponse,
  ErrorCode,
  IDEMPOTENCY_KEY_HEADER,
  type IdempotencyStore,
} from '@edunic/source/domain/shared';
import { verifyJwt } from '@edunic/source/domain/auth';
import { env } from '../config/env.js';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const idempotencyPluginHandler: FastifyPluginAsync = async (app) => {
  const redis = new Redis(resolveRedisUrl(), {
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // Stop retrying after a few attempts so a down Redis fails fast instead of
    // queueing every idempotency check.
    retryStrategy: (times) => (times > 2 ? null : 100),
  });
  // Degradation is handled per call site; without a listener ioredis would
  // crash the process on connection errors.
  redis.on('error', (error) => {
    void error;
  });

  const store = createRedisStore(redis);

  app.addHook('onClose', async () => {
    redis.disconnect();
  });

  // Runs before route preHandlers, so the actor is resolved from the JWT
  // directly instead of request.user (not yet populated by authenticate).
  app.addHook('preHandler', async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method) || isExcludedPath(request.url)) {
      return;
    }

    const headerValue = request.headers[IDEMPOTENCY_KEY_HEADER];
    const key = typeof headerValue === 'string' ? headerValue.trim() : '';

    if (!key) {
      return;
    }

    const actor = await resolveActor(request);

    if (!actor) {
      return;
    }

    const scopedKey = buildIdempotencyKey({
      institutionId: actor.institutionId,
      route: request.routeOptions.url ?? request.url,
      actorId: actor.id,
      key,
    });

    let lookup;

    try {
      lookup = await lookupIdempotency(store, scopedKey);
    } catch (error) {
      request.log.warn(
        { err: error },
        'Idempotency store unavailable; executing without replay protection'
      );
      return;
    }

    if (lookup.type === 'replay') {
      reply.header('content-type', 'application/json');
      reply.header('idempotency-replayed', 'true');
      return reply.status(lookup.status).send(lookup.payload);
    }

    if (lookup.type === 'in-flight') {
      return reply.status(409).send(
        createErrorEnvelope(
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'Idempotency key is already in progress',
          request.correlationId ?? request.id
        )
      );
    }

    request.idempotencyKey = scopedKey;
  });

  // Registered after envelope.plugin.ts, so the stored payload is the final
  // post-envelope response that a replay returns verbatim.
  app.addHook('onSend', async (request, reply, payload) => {
    const key = request.idempotencyKey;

    if (!key) {
      return payload;
    }

    try {
      if (reply.statusCode >= 200 && reply.statusCode < 300) {
        await storeIdempotentResponse(
          store,
          key,
          reply.statusCode,
          typeof payload === 'string' ? payload : ''
        );
      } else {
        // Release the claim so a failed attempt can be retried with the same
        // key instead of conflicting until the TTL expires.
        await releaseIdempotencyKey(store, key);
      }
    } catch (error) {
      request.log.warn(
        { err: error },
        'Failed to persist idempotency response'
      );
    }

    return payload;
  });
};

function resolveRedisUrl() {
  return (
    process.env.IDEMPOTENCY_REDIS_URL ??
    process.env.REDIS_URL ??
    'redis://127.0.0.1:6379'
  );
}

function createRedisStore(redis: Redis): IdempotencyStore {
  return {
    get: (key) => redis.get(key),
    setNx: async (key, value, ttlSeconds) =>
      (await redis.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK',
    set: async (key, value, ttlSeconds) => {
      await redis.set(key, value, 'EX', ttlSeconds);
    },
    delete: async (key) => {
      await redis.del(key);
    },
  };
}

async function resolveActor(request: FastifyRequest) {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    return { id: payload.sub, institutionId: payload.institutionId };
  } catch {
    // Invalid tokens are rejected by route auth; idempotency just skips them.
    return null;
  }
}

// Same exclusions as envelope.plugin.ts so login, docs, and health keep their
// current behavior.
function isExcludedPath(path: string) {
  return (
    path.startsWith('/auth/login') ||
    path.startsWith('/docs') ||
    path.startsWith('/health')
  );
}

export const idempotencyPlugin = fp(idempotencyPluginHandler, {
  name: 'idempotency-plugin',
});
