import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('institutions routes', () => {
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

  it('scopes institution management to the authenticated tenant', async () => {
    const institution = await createInstitutionFixture('Central School');
    const otherInstitution = await createInstitutionFixture('North School');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const authHeaders = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const listResponse = await client.get('/institutions').set(authHeaders);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(1);
    expect(listResponse.body.data).toEqual([
      expect.objectContaining({
        id: institution.id,
        name: 'Central School',
      }),
    ]);

    const detailResponse = await client
      .get(`/institutions/${institution.id}`)
      .set(authHeaders);
    expect(detailResponse.status).toBe(200);

    const updateResponse = await client
      .patch(`/institutions/${institution.id}`)
      .set(authHeaders)
      .send({ name: 'Updated Institution' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Updated Institution');

    const otherDetailResponse = await client
      .get(`/institutions/${otherInstitution.id}`)
      .set(authHeaders);
    expect(otherDetailResponse.status).toBe(403);
    expect(otherDetailResponse.body.message).toBe('Institution access denied');

    const otherUpdateResponse = await client
      .patch(`/institutions/${otherInstitution.id}`)
      .set(authHeaders);
    expect(otherUpdateResponse.status).toBe(403);
    expect(otherUpdateResponse.body.message).toBe('Institution access denied');
  });

  it('prevents tenant admins from creating or deleting institutions', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const authHeaders = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const createResponse = await client.post('/institutions').set(authHeaders).send({
      name: 'New School',
    });

    expect(createResponse.status).toBe(403);
    expect(createResponse.body.message).toBe(
      'Institution creation requires platform administrator access'
    );

    const deleteResponse = await client
      .delete(`/institutions/${institution.id}`)
      .set(authHeaders);

    expect(deleteResponse.status).toBe(403);
    expect(deleteResponse.body.message).toBe(
      'Institution deletion requires platform administrator access'
    );
  });

  it('checks tenant access before deleting another institution', async () => {
    const institution = await createInstitutionFixture();
    const otherInstitution = await createInstitutionFixture('Other School');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    await createStudentFixture({ institutionId: otherInstitution.id });

    const response = await client
      .delete(`/institutions/${otherInstitution.id}`)
      .set(
        createAuthHeaders({
          userId: adminUser.id,
          institutionId: institution.id,
        })
      );

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Institution access denied');
  });
});
