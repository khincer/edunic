import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createAttendanceFixture,
  createAuditLogFixture,
  createClassroomFixture,
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

describe('cursor pagination for the remaining list modules', () => {
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

  // Walks the keyset cursor until hasMore is false. Bounded so a broken cursor
  // wire (cursor dropped, first page repeated forever) fails on duplicates
  // instead of hanging the suite.
  async function walkCursorPages(path: string, limit: number) {
    const ids: string[] = [];
    let cursor: string | undefined = 'start';
    let pages = 0;

    do {
      const response = await client
        .get(`${path}?limit=${limit}&cursor=${encodeURIComponent(cursor)}`)
        .set(headers);

      expect(response.status).toBe(200);
      // Cursor mode: keyset contract, no legacy metadata or deprecation.
      expect(response.headers['x-pagination-deprecated']).toBeUndefined();
      expect(response.body.meta).toBeUndefined();
      // nextCursor is present if and only if another page exists.
      expect(response.body.hasMore).toBe(response.body.nextCursor !== undefined);

      ids.push(...response.body.data.map((row: { id: string }) => row.id));
      cursor = response.body.hasMore ? response.body.nextCursor : undefined;
      pages += 1;
    } while (cursor && pages < 10);

    expect(cursor).toBeUndefined();
    return ids;
  }

  type PaginatedListCase = {
    label: string;
    path: string;
    /** Seeds five rows and returns the ids in the module's stable keyset order. */
    seed: () => Promise<{ count: number; stableOrderIds: string[] }>;
    /** Uniform filter/sort param the module whitelists, and the rows it selects. */
    filter: { query: string; expectedCount: number };
  };

  const cases: PaginatedListCase[] = [
    {
      label: 'academic-periods',
      path: '/academic-periods',
      seed: async () => {
        const created = [];

        for (const year of [2021, 2022, 2023, 2024, 2025]) {
          created.push(
            await createAcademicPeriodFixture({ institutionId, year, term: 1 })
          );
        }

        // Stable order: year desc, id desc.
        return { count: 5, stableOrderIds: created.map((row) => row.id).reverse() };
      },
      filter: { query: 'filter=year:eq:2023', expectedCount: 1 },
    },
    {
      label: 'audit-logs',
      path: '/audit-logs',
      seed: async () => {
        const created = [];

        // Two entities so the filter assertion below selects a strict subset.
        for (const second of [1, 2, 3, 4, 5]) {
          created.push(
            await createAuditLogFixture({
              institutionId,
              entity: second % 2 === 1 ? 'students' : 'grades',
              // Distinct createdAt values: the cursor only carries millisecond
              // precision, so same-millisecond rows would fall out of the keyset.
              createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, second)),
            })
          );
        }

        // Stable order: created_at desc, id desc.
        return { count: 5, stableOrderIds: created.map((row) => row.id).reverse() };
      },
      filter: { query: 'filter=entity:eq:grades', expectedCount: 2 },
    },
    {
      label: 'classrooms',
      path: '/classrooms',
      seed: async () => {
        const created = [];

        for (const gradeLevel of [1, 2, 3, 4, 5]) {
          created.push(
            await createClassroomFixture({ institutionId, gradeLevel })
          );
        }

        // Stable order: grade_level asc, id asc.
        return { count: 5, stableOrderIds: created.map((row) => row.id) };
      },
      filter: { query: 'filter=gradeLevel:eq:3', expectedCount: 1 },
    },
    {
      label: 'custom-fields',
      path: '/custom-fields',
      seed: async () => {
        const created: string[] = [];

        // Seeded in alphabetical order: the stable order is entity asc, id asc.
        for (const entity of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) {
          const response = await client
            .post('/custom-fields')
            .set(headers)
            .send({ entity, name: `${entity} field`, type: 'text' });

          expect(response.status).toBe(201);
          created.push(response.body.data.id);
        }

        return { count: 5, stableOrderIds: created };
      },
      filter: { query: 'filter=entity:eq:charlie', expectedCount: 1 },
    },
  ];

  describe.each(cases)('$label', (listCase) => {
    it(`pages ${listCase.label} without duplicates or gaps`, async () => {
      const { count, stableOrderIds } = await listCase.seed();

      const ids = await walkCursorPages(listCase.path, 2);

      expect(ids).toEqual(stableOrderIds);
      expect(ids).toHaveLength(count);
      expect(new Set(ids).size).toBe(count);
    });

    it(`serves the first page of ${listCase.label} for cursor=start`, async () => {
      const { stableOrderIds } = await listCase.seed();

      const firstPage = await client
        .get(`${listCase.path}?limit=2&cursor=start`)
        .set(headers);

      expect(firstPage.status).toBe(200);
      expect(firstPage.headers['x-pagination-deprecated']).toBeUndefined();
      expect(firstPage.body.data.map((row: { id: string }) => row.id)).toEqual(
        stableOrderIds.slice(0, 2)
      );

      const walked = await walkCursorPages(listCase.path, 2);
      expect(walked).toEqual(stableOrderIds);
    });

    it(`rejects a malformed cursor on ${listCase.label}`, async () => {
      const response = await client
        .get(`${listCase.path}?cursor=not-a-cursor`)
        .set(headers);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it(`marks legacy offset mode as deprecated on ${listCase.label}`, async () => {
      const { count } = await listCase.seed();

      const response = await client
        .get(`${listCase.path}?limit=2&offset=0`)
        .set(headers);

      expect(response.status).toBe(200);
      expect(response.headers['x-pagination-deprecated']).toBe('offset');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.hasMore).toBe(true);
      expect(response.body.nextCursor).toBeDefined();
      expect(response.body.meta).toEqual({ total: count, limit: 2, offset: 0 });
    });

    it(`applies the uniform filter params on ${listCase.label}`, async () => {
      await listCase.seed();

      const filtered = await client
        .get(`${listCase.path}?${listCase.filter.query}`)
        .set(headers);

      expect(filtered.status).toBe(200);
      expect(filtered.body.data).toHaveLength(listCase.filter.expectedCount);

      // Fields outside the whitelist never reach SQL construction.
      const unsupported = await client
        .get(`${listCase.path}?filter=institution_id:eq:whatever`)
        .set(headers);

      expect(unsupported.status).toBe(400);
      expect(unsupported.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
