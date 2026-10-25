import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance } from 'fastify';
import { corsPlugin } from '../../src/plugins/cors.plugin.js';
import { dbPlugin } from '../../src/plugins/db.plugin.js';
import { authPlugin } from '../../src/plugins/auth.plugin.js';
import { AuthRepository } from '@edunic/source/domain/auth';
import { db } from '@edunic/source/db';
import { createBearerToken } from '../helpers/auth.js';
import { ensureTestDatabaseReady, resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// AUTH-03, AUTH-04, TEN-07: the request user is {id, role}. The school is a
// configuration row, never part of identity, so authentication must not depend
// on it, and the legacy x-institution-id header neither selects nor allows
// anything.
describe('single-school request context', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await ensureTestDatabaseReady();
    app = Fastify();
    await app.register(corsPlugin);
    await app.register(dbPlugin);
    await app.register(authPlugin);
    app.get('/whoami', { preHandler: [app.authenticate] }, async (request) => ({
      user: request.user,
    }));
    await app.ready();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  async function whoami(userId: string, extraHeaders: Record<string, string> = {}) {
    return app.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        authorization: `Bearer ${await createBearerToken({
          userId,
          institutionId: 'unused',
        })}`,
        ...extraHeaders,
      },
    });
  }

  it('exposes exactly {id, role} on request.user (AUTH-03)', async () => {
    await createInstitutionFixture('Colegio Central');
    const director = await createUserFixture({
      institutionId: 'unused',
      role: 'director',
    });

    const response = await whoami(director.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual({ id: director.id, role: 'director' });
  });

  it('authenticates a teacher with the same shape (AUTH-03)', async () => {
    await createInstitutionFixture('Colegio Central');
    const teacher = await createUserFixture({
      institutionId: 'unused',
      role: 'teacher',
    });

    const response = await whoami(teacher.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual({ id: teacher.id, role: 'teacher' });
  });

  it('authenticates when no institutions row exists: the school profile is configuration, not identity', async () => {
    const parent = await createUserFixture({
      institutionId: 'unused',
      role: 'parent',
    });

    const response = await whoami(parent.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual({ id: parent.id, role: 'parent' });
  });

  it('still rejects a user that holds no role with 403', async () => {
    // A users row with no user_roles row.
    const orphan = await db.execute<{ id: string }>(sql`
      insert into users (email, password_hash)
      values ('no-role@example.com', 'x')
      returning id
    `);

    const response = await whoami(orphan.rows[0].id);

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe('User role was not found');
  });

  it('ignores an x-institution-id header, valid or not (AUTH-04)', async () => {
    const other = await createInstitutionFixture('Other');
    const director = await createUserFixture({
      institutionId: 'unused',
      role: 'director',
    });

    const withUuid = await whoami(director.id, { 'x-institution-id': other.id });
    const withGarbage = await whoami(director.id, {
      'x-institution-id': 'not-a-uuid',
    });

    expect(withUuid.statusCode).toBe(200);
    expect(withUuid.json().user).toEqual({ id: director.id, role: 'director' });
    expect(withGarbage.statusCode).toBe(200);
    expect(withGarbage.json().user).toEqual({ id: director.id, role: 'director' });
  });

  it('findAuthContext returns the role only (AUTH-03)', async () => {
    await createInstitutionFixture('Colegio Central');
    const teacher = await createUserFixture({
      institutionId: 'unused',
      role: 'teacher',
    });

    const context = await new AuthRepository(db).findAuthContext(teacher.id);

    expect(context).toEqual({ role: 'teacher' });
  });

  describe('CORS (AUTH-04)', () => {
    const preflight = (requestHeaders: string) =>
      app.inject({
        method: 'OPTIONS',
        url: '/whoami',
        headers: {
          origin: 'http://localhost:3001',
          'access-control-request-method': 'GET',
          'access-control-request-headers': requestHeaders,
        },
      });

    it('no longer allows the x-institution-id header', async () => {
      const response = await preflight('authorization, x-institution-id');

      expect(response.statusCode).toBe(204);
      expect(String(response.headers['access-control-allow-headers'])).not.toContain(
        'x-institution-id'
      );
    });

    it('keeps allowing the headers the API still reads', async () => {
      const response = await preflight('authorization');

      expect(String(response.headers['access-control-allow-headers'])).toBe(
        'authorization, content-type, x-request-id'
      );
    });
  });
});
