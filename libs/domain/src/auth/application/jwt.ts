import { SignJWT, jwtVerify, type JWTVerifyResult } from 'jose';

export type JwtPayload = {
  sub: string;
  exp: number;
};

function keyFor(secret: string) {
  return new TextEncoder().encode(secret);
}

// The token carries no institution: the school is resolved server-side from
// the user's own record, never from a client-supplied value.
export async function signJwt(
  payload: { sub: string; exp?: number },
  secret: string,
  expiresInSeconds = 60 * 60 * 12
) {
  const exp = payload.exp ?? Math.floor(Date.now() / 1000) + expiresInSeconds;

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(exp)
    .sign(keyFor(secret));
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  let verified: JWTVerifyResult;

  try {
    verified = await jwtVerify(token, keyFor(secret));
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_JWT_EXPIRED'
    ) {
      throw new Error('Token expired');
    }

    throw new Error('Invalid token');
  }

  const { sub, exp } = verified.payload;

  if (!sub || typeof exp !== 'number') {
    throw new Error('Invalid token');
  }

  return {
    sub,
    exp,
  };
}
