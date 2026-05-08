import dotenv from 'dotenv';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined');
}

function parseCsv(value: string | undefined) {
  return value
    ?.split(',')
    .map((item) => item.trim())
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
    ],
  CORS_ALLOW_CREDENTIALS: process.env.CORS_ALLOW_CREDENTIALS === 'true',
}
