import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const appRoot = resolve(root, 'apps/edunic-fe');
const standaloneAppRoot = resolve(
  appRoot,
  '.next/standalone/apps/edunic-fe'
);
const serverPath = resolve(standaloneAppRoot, 'server.js');

process.env.HOSTNAME = '0.0.0.0';

copyIfExists(
  resolve(appRoot, '.next/static'),
  resolve(standaloneAppRoot, '.next/static')
);
copyIfExists(resolve(appRoot, 'public'), resolve(standaloneAppRoot, 'public'));

if (!existsSync(serverPath)) {
  console.error(`Frontend standalone server not found: ${serverPath}`);
  process.exit(1);
}

await import(pathToFileURL(serverPath).href);

function copyIfExists(source, destination) {
  if (!existsSync(source)) return;

  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}
