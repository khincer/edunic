import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('API error envelope contract', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let institutionId: string;
  let adminHeaders: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });

    institutionId = institution.id;
    adminHeaders = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps 401 responses in an UNAUTHORIZED envelope with a correlation id', async () => {
    const response = await client.get('/students');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required',
    });
    expect(typeof response.body.correlationId).toBe('string');
    expect(response.body.correlationId.length).toBeGreaterThan(0);
  });

  it('wraps 403 responses in a FORBIDDEN envelope', async () => {
    const teacherUser = await createUserFixture({
      institutionId,
      role: 'teacher',
    });
    const teacherHeaders = await createAuthHeaders({
      userId: teacherUser.id,
      institutionId,
    });

    const response = await client
      .post('/students')
      .set(teacherHeaders)
      .send({ firstName: 'Ana', lastName: 'Lopez', dateOfBirth: '2012-01-01' });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('wraps 404 responses in a NOT_FOUND envelope', async () => {
    const missingId = '99999999-9999-4999-8999-999999999999';

    const response = await client
      .get(`/students/${missingId}`)
      .set(adminHeaders);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(typeof response.body.correlationId).toBe('string');
  });

  it('wraps 409 responses in a CONFLICT envelope', async () => {
    await createAcademicPeriodFixture({ institutionId, year: 2026, term: 1 });

    const response = await client.post('/academic-periods').set(adminHeaders).send({
      year: 2026,
      term: 1,
      startDate: '2026-01-15',
      endDate: '2026-03-31',
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'CONFLICT' });
  });

  it('wraps CursorPage list responses in the data envelope', async () => {
    await createStudentFixture({ institutionId });

    const response = await client.get('/students?cursor=start').set(adminHeaders);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.hasMore).toBe(false);
    expect(response.body.nextCursor).toBeUndefined();
  });

  it('keeps /health outside the envelope contract', async () => {
    const response = await client.get('/health');

    expect(response.status).toBe(200);
    // Raw body, no `data` envelope key — /health keeps its own shape.
    expect(response.body).toEqual({ status: 'ok' });
  });
});
