import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
  type UserRole,
} from '../helpers/fixtures.js';

describe('extensions routes (global, single school)', () => {
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

  async function headersFor(role: UserRole) {
    const institution = await createInstitutionFixture();
    const user = await createUserFixture({
      role,
    });

    return {
      institution,
      headers: await createAuthHeaders({
        userId: user.id,
      }),
    };
  }

  async function createNotifications(
    headers: Record<string, string>,
    enabled = true
  ) {
    return client
      .post('/extensions')
      .set(headers)
      .send({ key: 'notifications', name: 'Notifications', enabled });
  }

  it('registers an extension with no config and lists it', async () => {
    const { headers } = await headersFor('director');

    const created = await createNotifications(headers);

    expect(created.status).toBe(201);
    expect(created.body.data).toEqual({
      key: 'notifications',
      name: 'Notifications',
      enabled: true,
      config: null,
    });

    const list = await client.get('/extensions').set(headers);
    expect(list.body.data).toEqual([created.body.data]);
  });

  it('turns an extension on with PUT config and off with DELETE config', async () => {
    const { headers } = await headersFor('director');
    await createNotifications(headers);

    const on = await client
      .put('/extensions/notifications/config')
      .set(headers)
      .send({ config: { internalOnly: true } });

    expect(on.status).toBe(200);
    expect(on.body.data).toEqual({
      key: 'notifications',
      name: 'Notifications',
      enabled: true,
      config: { internalOnly: true },
    });

    const listed = await client.get('/extensions').set(headers);
    expect(listed.body.data[0].config).toEqual({ internalOnly: true });

    const empty = await client
      .put('/extensions/notifications/config')
      .set(headers)
      .send({});
    expect(empty.body.data.config).toEqual({});

    const off = await client
      .delete('/extensions/notifications/config')
      .set(headers);

    expect(off.status).toBe(200);
    expect(off.body.data.config).toBeNull();
    const stored = await db.execute(
      sql`select config from extensions where key = 'notifications'`
    );
    expect(stored.rows[0]).toEqual({ config: null });
  });

  it('returns 404 for an unknown extension and 400 for a bad config', async () => {
    const { headers } = await headersFor('director');
    await createNotifications(headers);

    for (const response of [
      await client
        .put('/extensions/missing/config')
        .set(headers)
        .send({ config: {} }),
      await client.delete('/extensions/missing/config').set(headers),
    ]) {
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Extension not found');
    }

    const invalid = await client
      .put('/extensions/notifications/config')
      .set(headers)
      .send({ config: 'on' });
    expect(invalid.status).toBe(400);
  });

  it('prevents teachers and parents from managing extensions', async () => {
    const { headers: adminHeaders } = await headersFor('director');
    await createNotifications(adminHeaders);

    for (const role of ['teacher', 'parent'] as const) {
      const { headers } = await headersFor(role);

      for (const response of [
        await createNotifications(headers),
        await client
          .put('/extensions/notifications/config')
          .set(headers)
          .send({ config: {} }),
        await client.delete('/extensions/notifications/config').set(headers),
      ]) {
        expect(response.status).toBe(403);
      }
    }
  });

  it('shows dashboard extension modules enabled only with global enabled and a config', async () => {
    const { headers } = await headersFor('director');
    await createNotifications(headers);
    await client
      .post('/extensions')
      .set(headers)
      .send({ key: 'billing', name: 'Billing', enabled: false });
    await client
      .post('/extensions')
      .set(headers)
      .send({ key: 'plain', name: 'Plain', enabled: true });
    await client
      .put('/extensions/notifications/config')
      .set(headers)
      .send({ config: {} });
    await client
      .put('/extensions/billing/config')
      .set(headers)
      .send({ config: {} });

    const response = await client.get('/dashboard/admin').set(headers);

    const modules = response.body.data.modules as {
      key: string;
      enabled: boolean;
      type: string;
    }[];
    const byKey = Object.fromEntries(
      modules
        .filter((module) => module.type === 'extension')
        .map((module) => [module.key, module.enabled])
    );
    expect(byKey).toEqual({
      billing: false,
      notifications: true,
      plain: false,
    });
  });

  it('removes the per-school extension routes', async () => {
    const { institution, headers } = await headersFor('director');
    const base = `/institutions/${institution.id}/extensions`;

    for (const response of [
      await client.get(base).set(headers),
      await client.put(`${base}/notifications`).set(headers).send({ config: {} }),
      await client.delete(`${base}/notifications`).set(headers),
    ]) {
      expect(response.status).toBe(404);
    }
  });
});
