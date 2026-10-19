import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders, createBearerToken } from '../helpers/auth.js';
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
      authorization: `Bearer ${await createBearerToken({
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
      .patch(`/institutions/${bootstrapInstitution.id}`)
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

  it('lets an admin configure its own institution sender identity', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const updateResponse = await client
      .patch(`/institutions/${institution.id}`)
      .set(headers)
      .send({
        senderName: '  Colegio Central  ',
        replyToEmail: '  respuestas@colegio.example  ',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.senderName).toBe('Colegio Central');
    expect(updateResponse.body.data.replyToEmail).toBe(
      'respuestas@colegio.example'
    );

    const detailResponse = await client
      .get(`/institutions/${institution.id}`)
      .set(headers);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.senderName).toBe('Colegio Central');
    expect(detailResponse.body.data.replyToEmail).toBe(
      'respuestas@colegio.example'
    );
  });

  it('rejects an admin writing another institution sender identity', async () => {
    const institution = await createInstitutionFixture('School A');
    const otherInstitution = await createInstitutionFixture('School B');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const otherAdminUser = await createUserFixture({
      institutionId: otherInstitution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
    const otherHeaders = await createAuthHeaders({
      userId: otherAdminUser.id,
      institutionId: otherInstitution.id,
    });

    const ownResponse = await client
      .patch(`/institutions/${otherInstitution.id}`)
      .set(otherHeaders)
      .send({ senderName: 'School B Sender' });

    expect(ownResponse.status).toBe(200);
    expect(ownResponse.body.data.senderName).toBe('School B Sender');

    const crossTenantResponse = await client
      .patch(`/institutions/${otherInstitution.id}`)
      .set(headers)
      .send({ senderName: 'Hijacked Sender' });

    expect(crossTenantResponse.status).toBe(403);
    expect(crossTenantResponse.body.message).toBe('Institution access denied');

    const detailResponse = await client
      .get(`/institutions/${otherInstitution.id}`)
      .set(otherHeaders);

    expect(detailResponse.body.data.senderName).toBe('School B Sender');
  });

  it('rejects an admin writing another institution name', async () => {
    const institution = await createInstitutionFixture('School A');
    const otherInstitution = await createInstitutionFixture('School B');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const otherAdminUser = await createUserFixture({
      institutionId: otherInstitution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
    const otherHeaders = await createAuthHeaders({
      userId: otherAdminUser.id,
      institutionId: otherInstitution.id,
    });

    const crossTenantResponse = await client
      .patch(`/institutions/${otherInstitution.id}`)
      .set(headers)
      .send({ name: 'Renamed by School A' });

    expect(crossTenantResponse.status).toBe(403);
    expect(crossTenantResponse.body.message).toBe('Institution access denied');

    const detailResponse = await client
      .get(`/institutions/${otherInstitution.id}`)
      .set(otherHeaders);

    expect(detailResponse.body.data.name).toBe('School B');
  });

  it('validates sender identity values', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const invalidResponse = await client
      .patch(`/institutions/${institution.id}`)
      .set(headers)
      .send({ replyToEmail: 'respuestas(at)colegio.example' });

    expect(invalidResponse.status).toBe(400);

    const seedResponse = await client
      .patch(`/institutions/${institution.id}`)
      .set(headers)
      .send({ senderName: 'Colegio Central' });

    expect(seedResponse.body.data.senderName).toBe('Colegio Central');

    const clearResponse = await client
      .patch(`/institutions/${institution.id}`)
      .set(headers)
      .send({ senderName: '   ', replyToEmail: '' });

    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body.data.senderName).toBeNull();
    expect(clearResponse.body.data.replyToEmail).toBeNull();
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
        authorization: `Bearer ${await createBearerToken({
          userId: adminUser.id,
          institutionId: institution.id,
        })}`,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('dependent academic records');
  });
});
