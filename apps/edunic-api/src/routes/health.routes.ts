import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

const PROBE_TIMEOUT_MS = 1000;

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness only: never touches dependencies, so process health stays
  // observable while Postgres/Redis are down (P4-R3). Use /health/db or
  // /ready for dependency diagnostics.
  app.get('/', async () => ({ status: 'ok' }));

  app.get('/db', async (_request, reply) => {
    try {
      const result = await app.db.execute(sql`select 1 as ok`);

      return { status: 'ok', database: 'ok', result: result.rows };
    } catch (error) {
      requestDbError(reply);

      return {
        status: 'error',
        database: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  });
};

// Registered at the root (not under /health) so readiness keeps its own
// identity; envelope.plugin.ts excludes the path explicitly.
export const readyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ready', async (_request, reply) => {
    const [database, redis, eventBus] = await Promise.allSettled([
      probeDatabase(app),
      pingRedis(resolveApiRedisUrl()),
      probeEventBus(),
    ]);

    const failing: string[] = [];
    if (database.status === 'rejected') {
      failing.push('database');
    }
    if (redis.status === 'rejected') {
      failing.push('redis');
    }
    if (eventBus.status === 'rejected') {
      failing.push('event-bus');
    }

    if (failing.length > 0) {
      reply.code(503);

      return { status: 'not_ready', failing };
    }

    return { status: 'ready', failing: [] };
  });
};

async function probeDatabase(app: FastifyInstance) {
  await app.db.execute(sql`select 1`);
}

// Same resolution order as the idempotency plugin's store client so readiness
// probes the Redis endpoint the API actually writes to.
function resolveApiRedisUrl() {
  return (
    process.env.IDEMPOTENCY_REDIS_URL ??
    process.env.REDIS_URL ??
    'redis://127.0.0.1:6379'
  );
}

async function probeEventBus() {
  // The in-memory bus has no external dependency; the redis backend does.
  if (process.env.EVENT_BUS_BACKEND !== 'redis') {
    return;
  }

  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is required when EVENT_BUS_BACKEND=redis');
  }

  await pingRedis(process.env.REDIS_URL);
}

async function pingRedis(url: string) {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: PROBE_TIMEOUT_MS,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    await client.ping();
  } finally {
    client.disconnect();
  }
}

function requestDbError(reply: { code: (statusCode: number) => unknown }) {
  reply.code(503);
}
