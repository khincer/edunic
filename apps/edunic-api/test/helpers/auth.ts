import { env } from '../../src/config/env.js';
import { signJwt } from '@edunic/source/domain/auth';

export async function createBearerToken(input: {
  userId: string;
  expiresAt?: number;
}) {
  // The token carries no school: the server never needs one.
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
  expiresAt?: number;
}) {
  return {
    authorization: `Bearer ${await createBearerToken(input)}`,
  };
}