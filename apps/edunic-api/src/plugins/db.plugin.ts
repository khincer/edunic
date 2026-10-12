import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createDb } from '@edunic/source/db';


const dbPluginHandler: FastifyPluginAsync = async (app) => {
	const { pool, db } = createDb();

	app.decorate('db', db);

	app.addHook('onClose', async () => {
		await pool.end();
	});
};

export const dbPlugin = fp(dbPluginHandler, {
	name: 'db-plugin',
});