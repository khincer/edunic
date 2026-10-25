import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import { createUserFixture } from '../helpers/fixtures.js';

// The admin dashboard names the school. While a second `institutions` row can
// still exist (the seed creates two until the contract migration), it must name
// the same school as the rest of the system: the oldest row, ties by lowest id
// (single_school_id(), AuthRepository.findAuthContext).
describe('admin dashboard school context', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('names the oldest school even when a newer one has a lower id', async () => {
    const oldest = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
    const newer = '00000000-0000-4000-8000-000000000001';

    // The newer row is inserted first so it is also first in physical order.
    await db.execute(sql`
      insert into institutions (id, name, created_at)
      values (${newer}, 'Newer school', '2026-01-01T00:00:00Z')
    `);
    await db.execute(sql`
      insert into institutions (id, name, created_at)
      values (${oldest}, 'Oldest school', '2020-01-01T00:00:00Z')
    `);

    const director = await createUserFixture({
      institutionId: oldest,
      role: 'director',
    });
    const headers = await createAuthHeaders({
      userId: director.id,
      institutionId: oldest,
    });

    const response = await client.get('/dashboard/admin').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data.institution).toEqual({
      id: oldest,
      name: 'Oldest school',
    });
  });
});
