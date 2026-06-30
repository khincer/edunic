import dotenv from 'dotenv';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

function parseCsv(value: string | undefined) {
  return value
    ?.trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => item.trim())
    .map((item) => item.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export const env = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGINS:
    parseCsv(process.env.CORS_ORIGINS) ?? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
      'http://127.0.0.1:3004',
      'http://*.edunic.test:3001',
      'http://*.localhost:3001',
      'http://*.localtest.me:3001',
      'http://*.lvh.me:3001',
      'http://app.central-school.test:3001',
      'http://app.north-school.test:3001',
    ],
  CORS_ALLOW_CREDENTIALS: process.env.CORS_ALLOW_CREDENTIALS === 'true',
}
