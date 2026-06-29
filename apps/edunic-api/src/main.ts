import { env } from './config/env.js';
import { buildApp } from './app.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: Number(env.PORT), host: '::' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
