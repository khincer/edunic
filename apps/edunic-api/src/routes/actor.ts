import type { FastifyRequest } from 'fastify';

// The authenticated caller, in the shape the read-scoping rules in
// AccessService expect.
export function actorOf(request: FastifyRequest) {
  return {
    role: request.user?.role ?? '',
    userId: request.user?.id ?? '',
  };
}
