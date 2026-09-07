import { SignJWT, jwtVerify } from 'jose';

export type JwtPayload = {
  sub: string;
  institutionId: string;
  exp: number;
};

function keyFor(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signJwt(
  payload: Omit<JwtPayload, 'exp'> & { exp?: number },
  secret: string,
  expiresInSeconds = 60 * 60 * 12
) {
  const exp = payload.exp ?? Math.floor(Date.now() / 1000) + expiresInSeconds;

  return new SignJWT({ institutionId: payload.institutionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(exp)
    .sign(keyFor(secret));
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  let verified: Awaited<ReturnType<typeof jwtVerify>>;

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

  const { sub, institutionId, exp } = verified.payload;

  if (!sub || typeof institutionId !== 'string' || typeof exp !== 'number') {
    throw new Error('Invalid token');
  }

  return {
    sub,
    institutionId,
    exp,
  };
}