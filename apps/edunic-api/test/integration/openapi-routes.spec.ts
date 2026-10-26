import type { RouteOptions } from 'fastify';
import { buildApp } from '../../src/app.js';
import { buildOpenApiDocument } from '../../src/docs/openapi.js';
import { ensureTestDatabaseReady } from '../helpers/db.js';

// NFR-05: the served OpenAPI document and the routes Fastify registers must
// not drift apart. Every registered route is documented and every documented
// operation is registered.
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Routes that serve the document itself or answer infrastructure probes.
const UNDOCUMENTED = new Set(['GET /docs', 'GET /docs/json']);

function toOpenApiPath(url: string) {
  const path = url.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

describe('OpenAPI document matches the registered routes', () => {
  const registered = new Set<string>();
  let close: () => Promise<void>;

  beforeAll(async () => {
    await ensureTestDatabaseReady();
    const app = await buildApp({
      onRoute: (route: RouteOptions) => {
        const methods = Array.isArray(route.method)
          ? route.method
          : [route.method];
        for (const method of methods) {
          if (METHODS.includes(method.toLowerCase())) {
            registered.add(`${method.toUpperCase()} ${toOpenApiPath(route.url)}`);
          }
        }
      },
    });
    await app.ready();
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  const documented = new Set(
    Object.entries(
      buildOpenApiDocument().paths as Record<string, Record<string, unknown>>
    ).flatMap(([path, operations]) =>
      Object.keys(operations)
        .filter((method) => METHODS.includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`)
    )
  );

  it('sees the routes of every module', () => {
    expect(registered.size).toBeGreaterThan(80);
    expect(registered).toContain('GET /students');
    expect(registered).toContain('GET /classrooms/{classroomId}/activity');
  });

  it('documents every registered route', () => {
    const missing = [...registered]
      .filter((route) => !documented.has(route) && !UNDOCUMENTED.has(route))
      .sort();

    expect(missing).toEqual([]);
  });

  it('registers every documented operation', () => {
    const stale = [...documented].filter((route) => !registered.has(route)).sort();

    expect(stale).toEqual([]);
  });
});
