import { db } from '@edunic/source/db';
import { featureFlags } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('feature flag routes', () => {
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

  it('returns effective flags and supports institution overrides', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const listResponse = await client.get('/feature-flags').set(headers);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual([
      {
        key: 'parent_portal',
        defaultValue: false,
        institutionEnabled: null,
        enabled: false,
        source: 'default',
      },
      {
        key: 'teacher_gradebook',
        defaultValue: true,
        institutionEnabled: null,
        enabled: true,
        source: 'default',
      },
    ]);

    const updateResponse = await client
      .put(`/institutions/${institution.id}/feature-flags/parent_portal`)
      .set(headers)
      .send({ enabled: true });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data).toMatchObject({
      key: 'parent_portal',
      enabled: true,
      institutionEnabled: true,
      source: 'institution',
    });

    const resetResponse = await client
      .delete(`/institutions/${institution.id}/feature-flags/parent_portal`)
      .set(headers);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data).toMatchObject({
      key: 'parent_portal',
      enabled: false,
      institutionEnabled: null,
      source: 'default',
    });
  });

  it('prevents teachers from managing feature flags', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .put(`/institutions/${institution.id}/feature-flags/parent_portal`)
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      )
      .send({ enabled: true });

    expect(response.status).toBe(403);
  });

  it('prevents admins from managing another institution flags', async () => {
    const institution = await createInstitutionFixture();
    const otherInstitution = await createInstitutionFixture('Other School');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });

    const response = await client
      .put(
        `/institutions/${otherInstitution.id}/feature-flags/parent_portal`
      )
      .set(
        createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      )
      .send({ enabled: true });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Institution access denied');
  });

  it('returns 404 when managing an unknown feature flag', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });

    const response = await client
      .put(`/institutions/${institution.id}/feature-flags/missing_feature`)
      .set(
        createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      )
      .send({ enabled: true });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Feature flag not found');
  });
});
