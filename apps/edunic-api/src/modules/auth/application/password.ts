import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');

  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, expectedHash] = storedHash.split('$');

  if (prefix !== PASSWORD_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const candidateHash = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (candidateHash.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateHash, expectedBuffer);
}
