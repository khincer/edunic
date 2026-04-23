import { drizzle } from 'drizzle-orm/node-postgres';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import pg from 'pg';


const dbPluginHandler: FastifyPluginAsync = async (app) => {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not set');
	}

	const pool = new pg.Pool({
		connectionString: databaseUrl,
	});

	app.decorate('db', drizzle(pool));

	app.addHook('onClose', async () => {
		await pool.end();
	});
};

export const dbPlugin = fp(dbPluginHandler, {
	name: 'db-plugin',
});
