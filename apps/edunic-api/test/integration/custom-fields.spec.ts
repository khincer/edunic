import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('custom fields routes', () => {
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

  it('creates field definitions and upserts typed values', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const fieldResponse = await client.post('/custom-fields').set(headers).send({
      entity: 'students',
      name: 'Scholarship',
      type: 'boolean',
    });

    expect(fieldResponse.status).toBe(201);
    const fieldId = fieldResponse.body.data.id;

    const valueResponse = await client
      .put(`/custom-fields/values/students/${student.id}`)
      .set(headers)
      .send({
        values: [
          {
            fieldId,
            value: true,
          },
        ],
      });

    expect(valueResponse.status).toBe(200);
    expect(valueResponse.body.data[0].value).toBe(true);
  });

  it('rejects invalid typed values', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const fieldResponse = await client.post('/custom-fields').set(headers).send({
      entity: 'students',
      name: 'Scholarship',
      type: 'boolean',
    });

    const response = await client
      .put(`/custom-fields/values/students/${student.id}`)
      .set(headers)
      .send({
        values: [
          {
            fieldId: fieldResponse.body.data.id,
            value: 'yes',
          },
        ],
      });

    expect(response.status).toBe(400);
  });
});
