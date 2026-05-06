import { env } from '../../src/config/env.js';
import { signJwt } from '../../src/modules/auth/application/jwt.js';

export function createBearerToken(input: {
  userId: string;
  institutionId: string;
}) {
  return signJwt(
    {
      sub: input.userId,
      institutionId: input.institutionId,
    },
    env.JWT_SECRET
  );
}

export function createAuthHeaders(input: {
  userId: string;
  institutionId: string;
}) {
  return {
    authorization: `Bearer ${createBearerToken(input)}`,
    'x-institution-id': input.institutionId,
  };
}
