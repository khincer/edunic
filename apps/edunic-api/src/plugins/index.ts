import type { FastifyInstance } from 'fastify';
import { authPlugin } from './auth.plugin.js';
import { auditLogsPlugin } from './audit-logs.plugin.js';
import { dbPlugin } from './db.plugin.js';

export async function registerPlugins(app: FastifyInstance) {
	await app.register(dbPlugin);
	await app.register(authPlugin);
	await app.register(auditLogsPlugin);
}
