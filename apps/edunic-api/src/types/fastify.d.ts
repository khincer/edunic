declare module 'fastify' {
  interface FastifyInstance {
    db:any;
    featureFlags: any;
    authenticate: any;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      institutionId: string;
      role: string;
    };
    featureFlags?: Record<string, boolean>;
  }
}
