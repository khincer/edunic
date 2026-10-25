import { env } from '../../src/config/env.js';
import { signJwt } from '@edunic/source/domain/auth';

export async function createBearerToken(input: {
  userId: string;
  institutionId?: string; // deprecated and ignored, removed by S1.8a part 2
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
  institutionId?: string; // deprecated and ignored, removed by S1.8a part 2
  expiresAt?: number;
}) {
  return {
    authorization: `Bearer ${await createBearerToken(input)}`,
  };
}