import type { FastifyRequest } from 'fastify';

export class InstitutionNotResolvedError extends Error {
  public readonly statusCode = 401;

  constructor() {
    super('The institution for this request was not resolved');
    this.name = 'InstitutionNotResolvedError';
  }
}

// The institution is resolved server-side from the authenticated user, never
// from a client-supplied header. The tenant columns survive until the contract
// migration, so the domain still filters by it in the meantime.
// shortcut: this resolves one institution per user; the domain stops filtering
// by institution before the column is dropped.
export function getInstitutionId(request: FastifyRequest): string {
  const institutionId = request.user?.institutionId;

  if (!institutionId) {
    throw new InstitutionNotResolvedError();
  }

  return institutionId;
}
