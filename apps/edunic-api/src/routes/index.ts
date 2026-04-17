import { FastifyInstance } from "fastify";
import { healthRoutes } from "./health.routes";

export async function registerRoutes(app: FastifyInstance) {
  app.register(healthRoutes, { prefix: '/health' });
}
