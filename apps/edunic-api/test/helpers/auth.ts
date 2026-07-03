import { env } from '../../src/config/env.js';
import { signJwt } from '../../src/modules/auth/application/jwt.js';

export function createBearerToken(input: {
  userId: string;
  institutionId: string;
  expiresAt?: number;
}) {
  return signJwt(
    {
      sub: input.userId,
      institutionId: input.institutionId,
      exp: input.expiresAt,
    },
    env.JWT_SECRET
  );
}

export function createAuthHeaders(input: {
  userId: string;
  institutionId: string;
  expiresAt?: number;
}) {
  return {
    authorization: `Bearer ${createBearerToken(input)}`,
    'x-institution-id': input.institutionId,
  };
}
