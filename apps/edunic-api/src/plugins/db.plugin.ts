import { drizzle } from 'drizzle-orm/node-postgres';
import type { FastifyPluginAsync } from 'fastify';
import pg from 'pg';

export const dbPlugin: FastifyPluginAsync = async (app) => {
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
