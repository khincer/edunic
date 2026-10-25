import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('school profile routes', () => {
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

  async function createAdmin() {
    const institution = await createInstitutionFixture('Colegio Central');
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });

    return {
      institution,
      headers: await createAuthHeaders({
        userId: adminUser.id,
        institutionId: institution.id,
      }),
    };
  }

  it('returns the school profile to an admin', async () => {
    const { headers } = await createAdmin();

    const response = await client.get('/school-profile').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Colegio Central');
    expect(response.body.data.senderName).toBeNull();
    expect(response.body.data.replyToEmail).toBeNull();
  });

  it('keeps the profile away from a teacher', async () => {
    const institution = await createInstitutionFixture();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const headers = await createAuthHeaders({
      userId: teacher.id,
      institutionId: institution.id,
    });

    const response = await client.get('/school-profile').set(headers);

    expect(response.status).toBe(403);
  });

  it('configures the sender identity of the outbound email', async () => {
    const { headers } = await createAdmin();

    const updateResponse = await client
      .patch('/school-profile')
      .set(headers)
      .send({
        name: '  Colegio Central  ',
        senderName: '  Colegio Central  ',
        replyToEmail: '  respuestas@colegio.example  ',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Colegio Central');
    expect(updateResponse.body.data.senderName).toBe('Colegio Central');
    expect(updateResponse.body.data.replyToEmail).toBe(
      'respuestas@colegio.example'
    );

    const profileResponse = await client.get('/school-profile').set(headers);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.senderName).toBe('Colegio Central');
    expect(profileResponse.body.data.replyToEmail).toBe(
      'respuestas@colegio.example'
    );
  });

  it('has exactly one profile: there is nothing to pick from', async () => {
    const { headers } = await createAdmin();

    // A second row is not part of the product any more, and the endpoint
    // never exposes one.
    await createInstitutionFixture('Another School');

    const response = await client.get('/school-profile').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Colegio Central');
  });
});
