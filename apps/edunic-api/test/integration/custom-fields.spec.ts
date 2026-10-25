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
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const fieldResponse = await client.post('/custom-fields').set(headers).send({
      entity: 'students',
      name: 'Scholarship',
      type: 'boolean',
    });

    expect(fieldResponse.status).toBe(201);
    expect(fieldResponse.body.data).not.toHaveProperty('institutionId');
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
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = await createAuthHeaders({
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

  it('lists, updates and deletes fields without exposing institutionId', async () => {
    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const student = await createStudentFixture({ institutionId: institution.id });
    const headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });

    const first = await client
      .post('/custom-fields')
      .set(headers)
      .send({ entity: 'students', name: 'Shirt size', type: 'text' });
    // custom_fields has no unique key: the same entity/name may repeat.
    const second = await client
      .post('/custom-fields')
      .set(headers)
      .send({ entity: 'students', name: 'Shirt size', type: 'text' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const list = await client.get('/custom-fields').query({ entity: 'students' }).set(headers);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0]).not.toHaveProperty('institutionId');

    const patched = await client
      .patch(`/custom-fields/${first.body.data.id}`)
      .set(headers)
      .send({ name: 'Uniform size' });

    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe('Uniform size');
    expect(patched.body.data).not.toHaveProperty('institutionId');

    await client
      .put(`/custom-fields/values/students/${student.id}`)
      .set(headers)
      .send({ values: [{ fieldId: first.body.data.id, value: 'M' }] });

    const blocked = await client.delete(`/custom-fields/${first.body.data.id}`).set(headers);
    const removed = await client.delete(`/custom-fields/${second.body.data.id}`).set(headers);
    const missing = await client.delete(`/custom-fields/${second.body.data.id}`).set(headers);

    expect(blocked.status).toBe(409);
    expect(removed.status).toBe(200);
    expect(missing.status).toBe(404);

    const values = await client.get(`/custom-fields/values/students/${student.id}`).set(headers);

    expect(values.status).toBe(200);
    expect(values.body.data).toHaveLength(1);
    expect(values.body.data[0].value).toBe('M');
  });

  it('keeps every custom-field route (values included) admin only', async () => {
    const institution = await createInstitutionFixture();
    const student = await createStudentFixture({ institutionId: institution.id });

    for (const role of ['teacher', 'parent'] as const) {
      const user = await createUserFixture({ institutionId: institution.id, role });
      const headers = await createAuthHeaders({
        userId: user.id,
        institutionId: institution.id,
      });

      const read = await client
        .get(`/custom-fields/values/students/${student.id}`)
        .set(headers);
      const write = await client
        .put(`/custom-fields/values/students/${student.id}`)
        .set(headers)
        .send({ values: [] });
      const list = await client.get('/custom-fields').set(headers);

      expect([read.status, write.status, list.status]).toEqual([403, 403, 403]);
    }
  });
});
