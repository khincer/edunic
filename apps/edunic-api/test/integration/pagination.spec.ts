import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createAttendanceFixture,
  createEnrollmentFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('list pagination conventions', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let institutionId: string;
  let headers: Record<string, string>;

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
    headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('pages students with keyset cursors without duplicates or gaps', async () => {
    const names = [
      { firstName: 'Mike', lastName: 'Alpha' },
      { firstName: 'Ana', lastName: 'Zeta' },
      { firstName: 'Bea', lastName: 'Zeta' },
      { firstName: 'Cleo', lastName: 'Beta' },
      { firstName: 'Dario', lastName: 'Gamma' },
    ];

    for (const name of names) {
      await createStudentFixture({ institutionId, ...name });
    }

    const collectedNames: string[] = [];
    const collectedIds: string[] = [];
    // `cursor=start` requests the first page in stable keyset order.
    let cursor: string | undefined = 'start';

    do {
      const url = `/students?limit=2&cursor=${encodeURIComponent(cursor)}`;
      const response = await client.get(url).set(headers);

      expect(response.status).toBe(200);
      // Cursor mode: keyset contract, no legacy metadata or deprecation.
      expect(response.headers['x-pagination-deprecated']).toBeUndefined();
      expect(response.body.meta?.total).toBeUndefined();

      collectedNames.push(
        ...response.body.data.map((row: { fullName: string }) => row.fullName)
      );
      collectedIds.push(
        ...response.body.data.map((row: { id: string }) => row.id)
      );

      // nextCursor is present if and only if another page exists.
      expect(response.body.hasMore).toBe(response.body.nextCursor !== undefined);
      cursor = response.body.hasMore ? response.body.nextCursor : undefined;
    } while (cursor);

    // Stable order: last_name asc, first_name asc, id asc.
    expect(collectedNames).toEqual([
      'Mike Alpha',
      'Cleo Beta',
      'Dario Gamma',
      'Ana Zeta',
      'Bea Zeta',
    ]);
    expect(new Set(collectedIds).size).toBe(5);
  });

  it('keeps the legacy offset contract, marks it deprecated, and allows switching to cursors', async () => {
    const names = [
      { firstName: 'Ana', lastName: 'Alfa' },
      { firstName: 'Bea', lastName: 'Beta' },
      { firstName: 'Cleo', lastName: 'Gamma' },
    ];

    for (const name of names) {
      await createStudentFixture({ institutionId, ...name });
    }

    const legacy = await client
      .get('/students?limit=2&offset=0&sort=lastName:asc')
      .set(headers);

    expect(legacy.status).toBe(200);
    expect(legacy.headers['x-pagination-deprecated']).toBe('offset');
    expect(legacy.body.meta).toEqual({ total: 3, limit: 2, offset: 0 });
    expect(legacy.body.hasMore).toBe(true);
    expect(legacy.body.nextCursor).toBeDefined();
    expect(
      legacy.body.data.map((row: { fullName: string }) => row.fullName)
    ).toEqual(['Ana Alfa', 'Bea Beta']);

    // The next cursor switches the client to keyset pagination mid-stream.
    const cursorPage = await client
      .get(`/students?limit=2&cursor=${encodeURIComponent(legacy.body.nextCursor)}`)
      .set(headers);

    expect(cursorPage.status).toBe(200);
    expect(cursorPage.headers['x-pagination-deprecated']).toBeUndefined();
    expect(
      cursorPage.body.data.map((row: { fullName: string }) => row.fullName)
    ).toEqual(['Cleo Gamma']);
    expect(cursorPage.body.hasMore).toBe(false);
    expect(cursorPage.body.nextCursor).toBeUndefined();
  });

  it('applies the attendance stable order (date desc, id desc) across cursor pages', async () => {
    const student = await createStudentFixture({ institutionId });
    const period = await createAcademicPeriodFixture({ institutionId });
    const enrollment = await createEnrollmentFixture({
      institutionId,
      studentId: student.id,
      academicPeriodId: period.id,
    });

    const dates = ['2026-03-01', '2026-03-02', '2026-03-03'];
    for (const date of dates) {
      await createAttendanceFixture({
        institutionId,
        enrollmentId: enrollment.id,
        date: new Date(`${date}T00:00:00.000Z`),
      });
    }

    const firstPage = await client
      .get('/attendance?limit=2')
      .set(headers);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.data[0].date).toContain('2026-03-03');
    expect(firstPage.body.data[1].date).toContain('2026-03-02');
    expect(firstPage.body.hasMore).toBe(true);

    const secondPage = await client
      .get(
        `/attendance?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`
      )
      .set(headers);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.data[0].date).toContain('2026-03-01');
    expect(secondPage.body.hasMore).toBe(false);
    expect(secondPage.body.nextCursor).toBeUndefined();
  });

  it('supports the standard filter and sort params on students', async () => {
    const names = [
      { firstName: 'Ana', lastName: 'Lopez' },
      { firstName: 'Bea', lastName: 'Mendez' },
      { firstName: 'Cleo', lastName: 'Zeballos' },
    ];

    for (const name of names) {
      await createStudentFixture({ institutionId, ...name });
    }

    const filtered = await client
      .get('/students?filter=lastName:eq:Mendez')
      .set(headers);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].firstName).toBe('Bea');
    expect(filtered.body.hasMore).toBe(false);

    const sorted = await client
      .get('/students?sort=lastName:asc&limit=10')
      .set(headers);

    expect(sorted.status).toBe(200);
    expect(
      sorted.body.data.map((row: { fullName: string }) => row.fullName)
    ).toEqual(['Ana Lopez', 'Bea Mendez', 'Cleo Zeballos']);
  });

  it('rejects filter fields outside the whitelist with a validation envelope', async () => {
    const response = await client
      .get('/students?filter=institution_id:eq:whatever')
      .set(headers);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed cursors with a validation envelope', async () => {
    const response = await client
      .get('/students?cursor=not-a-cursor')
      .set(headers);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
