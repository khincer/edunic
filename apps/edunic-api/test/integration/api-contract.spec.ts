import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// Contract-drift net (P3-R3, P2-R9): every protected route must answer the
// same error envelope for missing credentials, and the auth-guarded resources
// must keep the CursorPage/idempotency contracts from design #922. A new route
// file added without `app.authenticate` fails the 401 sweep below.
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const PROTECTED_GET_ROUTES = [
  `/students`,
  `/students/${FAKE_ID}`,
  `/enrollments`,
  `/enrollments/${FAKE_ID}`,
  `/grades`,
  `/grades/${FAKE_ID}`,
  `/attendance`,
  `/classrooms`,
  `/academic-periods`,
  `/academic-periods/${FAKE_ID}`,
  `/guardians`,
  `/guardians/${FAKE_ID}`,
  `/students/${FAKE_ID}/guardians`,
  `/institutions`,
  `/institutions/${FAKE_ID}`,
  `/institutions/${FAKE_ID}/extensions`,
  `/audit-logs`,
  `/custom-fields`,
  `/custom-fields/values/student/${FAKE_ID}`,
  `/extensions`,
  `/feature-flags`,
  `/notifications`,
  `/messages`,
  `/assignments`,
  `/school-events`,
  `/dashboard/admin`,
  `/dashboard/teacher`,
  `/dashboard/parent`,
  `/academic-averages/students/${FAKE_ID}`,
  `/reports/students/${FAKE_ID}/academic-summary`,
];

const PROTECTED_POST_ROUTES = ['/students', '/enrollments', '/admin/bootstrap'];

async function countStudents() {
  const result = await db.execute(
    sql.raw('SELECT COUNT(*)::int AS count FROM students')
  );
  return (result.rows[0] as { count: number }).count;
}

describe('API contract-drift net (P3-R3, P2-R9)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('auth 401 envelope', () => {
    it.each(PROTECTED_GET_ROUTES)(
      'GET %s without a token answers the UNAUTHORIZED envelope',
      async (route) => {
        const response = await app.inject({ method: 'GET', url: route });

        expect(response.statusCode).toBe(401);
        const body = response.json();
        expect(body.code).toBe('UNAUTHORIZED');
        expect(body.message).toBe('Authentication is required');
        expect(typeof body.correlationId).toBe('string');
        expect(body.correlationId.length).toBeGreaterThan(0);
        // Error envelopes never carry the success `data` key.
        expect(body).not.toHaveProperty('data');
      }
    );

    it.each(PROTECTED_POST_ROUTES)(
      'POST %s without a token answers the UNAUTHORIZED envelope',
      async (route) => {
        const response = await app.inject({
          method: 'POST',
          url: route,
          payload: {},
        });

        expect(response.statusCode).toBe(401);
        const body = response.json();
        expect(body.code).toBe('UNAUTHORIZED');
        expect(body.message).toBe('Authentication is required');
        expect(typeof body.correlationId).toBe('string');
        expect(body).not.toHaveProperty('data');
      }
    );

    it('rejects an expired token with the UNAUTHORIZED envelope', async () => {
      const institution = await createInstitutionFixture();
      const adminUser = await createUserFixture({
        institutionId: institution.id,
        role: 'admin',
      });
      const expired = await createAuthHeaders({
        userId: adminUser.id,
        institutionId: institution.id,
        expiresAt: Math.floor(Date.now() / 1000) - 1,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/students',
        headers: { authorization: expired.authorization },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.code).toBe('UNAUTHORIZED');
      expect(body.message).toBe('Token expired');
      expect(body.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('RBAC 403 envelope', () => {
    let institutionId: string;

    beforeEach(async () => {
      const institution = await createInstitutionFixture();
      institutionId = institution.id;
    });

    it('answers the FORBIDDEN envelope when a teacher hits an admin-only mutation', async () => {
      const teacherUser = await createUserFixture({
        institutionId,
        role: 'teacher',
      });
      const teacherHeaders = await createAuthHeaders({
        userId: teacherUser.id,
        institutionId,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/students',
        headers: teacherHeaders,
        payload: { firstName: 'Ana', lastName: 'Lopez' },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toContain('permission');
      expect(typeof body.correlationId).toBe('string');
      expect(body).not.toHaveProperty('data');
    });

    it('answers the FORBIDDEN envelope when a parent reads an admin-only resource', async () => {
      const parentUser = await createUserFixture({
        institutionId,
        role: 'parent',
      });
      const parentHeaders = await createAuthHeaders({
        userId: parentUser.id,
        institutionId,
      });

      for (const route of ['/institutions', '/audit-logs']) {
        const response = await app.inject({
          method: 'GET',
          url: route,
          headers: parentHeaders,
        });

        expect(response.statusCode).toBe(403);
        expect(response.json().code).toBe('FORBIDDEN');
      }
    });

    it('answers the FORBIDDEN envelope on an x-institution-id mismatch', async () => {
      const adminUser = await createUserFixture({
        institutionId,
        role: 'admin',
      });
      const otherInstitution = await createInstitutionFixture('Other');
      const adminHeaders = await createAuthHeaders({
        userId: adminUser.id,
        institutionId,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/students',
        headers: { ...adminHeaders, 'x-institution-id': otherInstitution.id },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.code).toBe('FORBIDDEN');
      expect(body.message).toBe(
        'Authenticated institution does not match x-institution-id'
      );
    });
  });

  describe('validation 400 envelope', () => {
    let headers: Record<string, string>;

    beforeEach(async () => {
      const institution = await createInstitutionFixture();
      const adminUser = await createUserFixture({
        institutionId: institution.id,
        role: 'admin',
      });
      headers = await createAuthHeaders({
        userId: adminUser.id,
        institutionId: institution.id,
      });
    });

    it('answers VALIDATION_ERROR with details.issues for an invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/students',
        headers,
        payload: { firstName: 123 },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'firstName' })])
      );
      expect(typeof body.correlationId).toBe('string');
      expect(body).not.toHaveProperty('data');
      expect(await countStudents()).toBe(0);
    });

    it('answers VALIDATION_ERROR with details.issues for an invalid query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/students?limit=not-a-number',
        headers,
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'limit' })])
      );
      expect(body).not.toHaveProperty('data');
    });
  });

  describe('idempotency contract (P2-R5)', () => {
    const studentBody = {
      firstName: 'Idem',
      lastName: 'Potency',
      dateOfBirth: '2014-05-01',
    };

    let headers: Record<string, string>;

    beforeEach(async () => {
      const institution = await createInstitutionFixture();
      const adminUser = await createUserFixture({
        institutionId: institution.id,
        role: 'admin',
      });
      headers = await createAuthHeaders({
        userId: adminUser.id,
        institutionId: institution.id,
      });
    });

    it('replays a byte-identical response for a repeated key', async () => {
      const key = randomUUID();

      const first = await app.inject({
        method: 'POST',
        url: '/students',
        headers: { ...headers, 'idempotency-key': key },
        payload: studentBody,
      });

      expect(first.statusCode).toBe(201);
      expect(first.headers['idempotency-replayed']).toBeUndefined();

      const replay = await app.inject({
        method: 'POST',
        url: '/students',
        headers: { ...headers, 'idempotency-key': key },
        payload: studentBody,
      });

      expect(replay.statusCode).toBe(201);
      expect(replay.headers['idempotency-replayed']).toBe('true');
      expect(replay.rawPayload.equals(first.rawPayload)).toBe(true);
      expect(replay.json().data.id).toBe(first.json().data.id);
      expect(await countStudents()).toBe(1);
    });

    it('answers a concurrent duplicate with the IDEMPOTENCY_CONFLICT envelope', async () => {
      const key = randomUUID();
      const request = () =>
        app.inject({
          method: 'POST',
          url: '/students',
          headers: { ...headers, 'idempotency-key': key },
          payload: studentBody,
        });

      const [first, second] = await Promise.all([request(), request()]);

      expect([first.statusCode, second.statusCode].sort()).toEqual([201, 409]);

      const conflict = first.statusCode === 409 ? first : second;
      const body = conflict.json();
      expect(body.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(typeof body.message).toBe('string');
      expect(typeof body.correlationId).toBe('string');
      expect(await countStudents()).toBe(1);
    });
  });

  describe('CursorPage contract (P2-R4)', () => {
    let headers: Record<string, string>;

    beforeEach(async () => {
      const institution = await createInstitutionFixture();
      const adminUser = await createUserFixture({
        institutionId: institution.id,
        role: 'admin',
      });
      headers = await createAuthHeaders({
        userId: adminUser.id,
        institutionId: institution.id,
      });

      const names = [
        { firstName: 'Mike', lastName: 'Alpha' },
        { firstName: 'Ana', lastName: 'Zeta' },
        { firstName: 'Bea', lastName: 'Zeta' },
        { firstName: 'Cleo', lastName: 'Beta' },
        { firstName: 'Dario', lastName: 'Gamma' },
      ];
      for (const name of names) {
        await createStudentFixture({ institutionId: institution.id, ...name });
      }
    });

    it('walks cursor pages with no duplicates, no gaps, and no meta', async () => {
      const collected: string[] = [];
      let cursor: string | undefined = 'start';

      do {
        const response: Awaited<ReturnType<typeof app.inject>> = await app.inject({
          method: 'GET',
          url: `/students?limit=2&cursor=${encodeURIComponent(cursor)}`,
          headers,
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-pagination-deprecated']).toBeUndefined();

        const body = response.json();
        expect(Array.isArray(body.data)).toBe(true);
        expect(typeof body.hasMore).toBe('boolean');
        // Cursor mode: keyset pages carry no legacy meta block.
        expect(body.meta).toBeUndefined();
        // nextCursor is present if and only if another page exists.
        expect(body.hasMore).toBe(body.nextCursor !== undefined);

        collected.push(...body.data.map((row: { id: string }) => row.id));
        cursor = body.hasMore ? body.nextCursor : undefined;
      } while (cursor);

      expect(collected).toHaveLength(5);
      expect(new Set(collected).size).toBe(5);
    });

    it('keeps the legacy offset page shape with nested meta and the deprecation header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/students?limit=2&offset=0',
        headers,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-pagination-deprecated']).toBe('offset');

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.hasMore).toBe(true);
      expect(body.nextCursor).toBeDefined();
      expect(body.meta).toEqual({ total: 5, limit: 2, offset: 0 });
    });
  });
});
