import type { FastifyInstance } from 'fastify';
import { dbPlugin } from './db.plugin.js';

export async function registerPlugins(app: FastifyInstance) {
	await app.register(dbPlugin);
}
