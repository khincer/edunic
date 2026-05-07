import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('extensions routes', () => {
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

  it('supports extension CRUD and institution enablement', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/extensions').set(headers).send({
      key: 'notifications',
      name: 'Notifications',
      enabled: true,
    });

    expect(createResponse.status).toBe(201);

    const enableResponse = await client
      .put(`/institutions/${institution.id}/extensions/notifications`)
      .set(headers)
      .send({
        config: {
          internalOnly: true,
        },
      });

    expect(enableResponse.status).toBe(200);
    expect(enableResponse.body.data.extensionKey).toBe('notifications');

    const listResponse = await client
      .get(`/institutions/${institution.id}/extensions`)
      .set(headers);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
  });

  it('prevents teacher users from managing extensions', async () => {
    const institution = await createInstitutionFixture();
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .post('/extensions')
      .set(
        createAuthHeaders({
          userId: teacherUser.id,
          institutionId: institution.id,
        })
      )
      .send({
        key: 'notifications',
        name: 'Notifications',
      });

    expect(response.status).toBe(403);
  });
});
