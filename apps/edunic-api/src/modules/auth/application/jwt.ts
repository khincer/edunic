import { createHmac } from 'node:crypto';

export type JwtPayload = {
  sub: string;
  institutionId: string;
  exp: number;
};

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));

  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function sign(value: string, secret: string) {
  return toBase64Url(createHmac('sha256', secret).update(value).digest());
}

export function signJwt(
  payload: Omit<JwtPayload, 'exp'> & { exp?: number },
  secret: string,
  expiresInSeconds = 60 * 60 * 12
) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const completePayload: JwtPayload = {
    ...payload,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(completePayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string, secret: string) {
  const [encodedHeader, encodedPayload, providedSignature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !providedSignature) {
    throw new Error('Invalid token');
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  if (expectedSignature !== providedSignature) {
    throw new Error('Invalid token');
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as JwtPayload;

  if (!payload.sub || !payload.institutionId || !payload.exp) {
    throw new Error('Invalid token');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}
