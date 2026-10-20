import { env } from '../../src/config/env.js';
import { signJwt } from '@edunic/source/domain/auth';

export async function createBearerToken(input: {
  userId: string;
  institutionId: string;
  expiresAt?: number;
}) {
  // The token carries no institution: the server resolves it from the user's
  // own record. The institution is still sent as a header so the tests keep
  // exercising the request shape they always had.
  return signJwt(
    {
      sub: input.userId,
      exp: input.expiresAt,
    },
    env.JWT_SECRET
  );
}

export async function createAuthHeaders(input: {
  userId: string;
  institutionId: string;
  expiresAt?: number;
}) {
  return {
    authorization: `Bearer ${await createBearerToken(input)}`,
    'x-institution-id': input.institutionId,
  };
}