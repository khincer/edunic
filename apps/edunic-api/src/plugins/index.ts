import type { FastifyInstance } from 'fastify';
import { authPlugin } from './auth.plugin.js';
import { auditLogsPlugin } from './audit-logs.plugin.js';
import { corsPlugin } from './cors.plugin.js';
import { dbPlugin } from './db.plugin.js';
import { eventBusPlugin } from './event-bus.plugin.js';
import { notificationsPlugin } from './notifications.plugin.js';

export async function registerPlugins(app: FastifyInstance) {
	await app.register(corsPlugin);
	await app.register(dbPlugin);
	await app.register(eventBusPlugin);
	await app.register(authPlugin);
	await app.register(auditLogsPlugin);
	await app.register(notificationsPlugin);
}
