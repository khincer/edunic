import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/edu_platform';

async function resetSchema() {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });

  try {
    console.log('Dropping local database schema...');
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema if exists public cascade');
    await pool.query('create schema public');
    await pool.query('create extension if not exists pgcrypto');
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    console.log('Resetting database...');
    await resetSchema();
    execSync('npm run db:migrate', { stdio: 'inherit' });
    execSync('npm run db:seed', { stdio: 'inherit' });

    console.log('Database reset complete');
  } catch (err) {
    console.error('Reset failed', err);
    process.exit(1);
  }
}

void main();
