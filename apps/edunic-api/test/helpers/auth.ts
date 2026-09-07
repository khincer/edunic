import { env } from '../../src/config/env.js';
import { signJwt } from '../../../../libs/domain/src/auth/application/jwt.js';

export async function createBearerToken(input: {
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