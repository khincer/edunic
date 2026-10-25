import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { featureFlags } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('feature flag routes (global, single school)', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();
    await db.insert(featureFlags).values([
      { key: 'parent_portal', defaultValue: false },
      { key: 'teacher_gradebook', defaultValue: true },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function headersFor(role: string) {
    const institution = await createInstitutionFixture();
    const user = await createUserFixture({
      institutionId: institution.id,
      role,
    });

    return {
      institution,
      headers: await createAuthHeaders({
        userId: user.id,
        institutionId: institution.id,
      }),
    };
  }

  it('lists the global flags as key and enabled', async () => {
    const { headers } = await headersFor('director');

    const response = await client.get('/feature-flags').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      // Seeded by migration 0007 and restored by resetTestDatabase.
      { key: 'email_notifications', enabled: false },
      { key: 'parent_portal', enabled: false },
      { key: 'teacher_gradebook', enabled: true },
    ]);
  });

  it('lets an admin patch a flag and the list reflects it (both directions)', async () => {
    const { headers } = await headersFor('director');

    const enable = await client
      .patch('/feature-flags/parent_portal')
      .set(headers)
      .send({ enabled: true });

    expect(enable.status).toBe(200);
    expect(enable.body.data).toEqual({ key: 'parent_portal', enabled: true });

    const stored = await db.execute(
      sql`select default_value from feature_flags where key = 'parent_portal'`
    );
    expect(stored.rows[0]).toEqual({ default_value: true });

    const after = await client.get('/feature-flags').set(headers);
    expect(after.body.data).toContainEqual({
      key: 'parent_portal',
      enabled: true,
    });

    const disable = await client
      .patch('/feature-flags/teacher_gradebook')
      .set(headers)
      .send({ enabled: false });

    expect(disable.status).toBe(200);
    expect(disable.body.data).toEqual({
      key: 'teacher_gradebook',
      enabled: false,
    });
  });

  it('lets every admin role patch a flag', async () => {
    for (const role of ['director', 'vice_director', 'subdirector']) {
      const { headers } = await headersFor(role);
      const response = await client
        .patch('/feature-flags/parent_portal')
        .set(headers)
        .send({ enabled: role === 'director' });

      expect(response.status).toBe(200);
    }
  });

  it('prevents teachers and parents from patching flags', async () => {
    for (const role of ['teacher', 'parent']) {
      const { headers } = await headersFor(role);
      const response = await client
        .patch('/feature-flags/parent_portal')
        .set(headers)
        .send({ enabled: true });

      expect(response.status).toBe(403);
    }
  });

  it('lets a teacher read the flags', async () => {
    const { headers } = await headersFor('teacher');

    const response = await client.get('/feature-flags').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(3);
  });

  it('returns 404 for an unknown flag and 400 for a bad body', async () => {
    const { headers } = await headersFor('director');

    const missing = await client
      .patch('/feature-flags/missing_feature')
      .set(headers)
      .send({ enabled: true });

    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Feature flag not found');

    const invalid = await client
      .patch('/feature-flags/parent_portal')
      .set(headers)
      .send({ enabled: 'yes' });

    expect(invalid.status).toBe(400);
  });

  it('ignores legacy per-school override rows', async () => {
    const { institution, headers } = await headersFor('director');
    await db.execute(sql`
      insert into institution_feature_flags (institution_id, feature_key, enabled)
      values (${institution.id}, 'parent_portal', true)
    `);

    const response = await client.get('/feature-flags').set(headers);

    expect(response.body.data).toContainEqual({
      key: 'parent_portal',
      enabled: false,
    });
  });

  it('reads the dashboard feature modules from the global flags', async () => {
    const { institution, headers } = await headersFor('director');
    await db.execute(sql`
      insert into institution_feature_flags (institution_id, feature_key, enabled)
      values (${institution.id}, 'parent_portal', true)
    `);
    await client
      .patch('/feature-flags/teacher_gradebook')
      .set(headers)
      .send({ enabled: false });

    const response = await client.get('/dashboard/admin').set(headers);

    expect(response.status).toBe(200);
    const modules = response.body.data.modules as {
      key: string;
      enabled: boolean;
    }[];
    expect(modules.find((m) => m.key === 'parent_portal')?.enabled).toBe(false);
    expect(modules.find((m) => m.key === 'teacher_gradebook')?.enabled).toBe(
      false
    );
  });

  it('removes the per-school flag routes', async () => {
    const { institution, headers } = await headersFor('director');
    const base = `/institutions/${institution.id}/feature-flags`;

    for (const response of [
      await client.get(base).set(headers),
      await client
        .put(`${base}/parent_portal`)
        .set(headers)
        .send({ enabled: true }),
      await client.delete(`${base}/parent_portal`).set(headers),
    ]) {
      expect(response.status).toBe(404);
    }
  });
});
