import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createBearerToken } from '../helpers/auth.js';
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

  it('supports full CRUD for institutions', async () => {
    const bootstrapInstitution = await createInstitutionFixture('Bootstrap Institution');
    const adminUser = await createUserFixture({
      institutionId: bootstrapInstitution.id,
      role: 'admin',
    });
    const authHeaders = {
      authorization: `Bearer ${createBearerToken({
        userId: adminUser.id,
        institutionId: bootstrapInstitution.id,
      })}`,
    };

    const createResponse = await client.post('/institutions').set(authHeaders).send({
      name: '  Colegio Central ',
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.name).toBe('Colegio Central');
    const institutionId = createResponse.body.data.id;

    const listResponse = await client.get('/institutions').set(authHeaders);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.meta.total).toBe(2);
    expect(
      listResponse.body.data.some(
        (institution: { id: string }) => institution.id === institutionId
      )
    ).toBe(true);

    const detailResponse = await client
      .get(`/institutions/${institutionId}`)
      .set(authHeaders);
    expect(detailResponse.status).toBe(200);

    const updateResponse = await client
      .patch(`/institutions/${institutionId}`)
      .set(authHeaders)
      .send({ name: 'Updated Institution' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Updated Institution');

    const deleteResponse = await client
      .delete(`/institutions/${institutionId}`)
      .set(authHeaders);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.deleted).toBe(true);
  });

  it('returns 409 when deleting an institution with dependent records', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    await createStudentFixture({ institutionId: institution.id });

    const response = await client
      .delete(`/institutions/${institution.id}`)
      .set({
        authorization: `Bearer ${createBearerToken({
          userId: adminUser.id,
          institutionId: institution.id,
        })}`,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('dependent academic records');
  });
});
