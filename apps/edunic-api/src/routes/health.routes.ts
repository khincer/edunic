import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    try {
      await app.db.execute(sql`select 1`);

      return { status: 'ok', database: 'ok' };
    } catch {
      reply.code(503);

      return { status: 'degraded', database: 'error' };
    }
  });

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

function requestDbError(reply: { code: (statusCode: number) => unknown }) {
  reply.code(503);
}
