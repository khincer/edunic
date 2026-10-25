import { db } from '@edunic/source/db';
import { AuthRepository } from '@edunic/source/domain/auth';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('administrative role group', () => {
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

  async function signIn(role: 'director' | 'vice_director' | 'subdirector' | 'teacher' | 'parent') {
    const institution = await createInstitutionFixture('Colegio Central');
    const user = await createUserFixture({ institutionId: institution.id, role });

    return {
      institution,
      headers: await createAuthHeaders({
        userId: user.id,
        institutionId: institution.id,
      }),
    };
  }

  it.each(['director', 'vice_director', 'subdirector'] as const)(
    'lets the %s reach admin routes with the school resolved from the user',
    async (role) => {
      const { institution, headers } = await signIn(role);
      const student = await createStudentFixture({
        institutionId: institution.id,
        firstName: role,
      });

      const response = await client.get('/students').set(headers);

      expect(response.status).toBe(200);
      expect(response.body.data.map((s: { id: string }) => s.id)).toContain(student.id);
    }
  );

  it.each(['director', 'vice_director', 'subdirector'] as const)(
    'lets the %s read the school profile and the ledger',
    async (role) => {
      const { headers } = await signIn(role);

      const profile = await client.get('/school-profile').set(headers);
      const payments = await client.get('/payments').set(headers);

      expect(profile.status).toBe(200);
      expect(payments.status).toBe(200);
    }
  );

  it.each(['teacher', 'parent'] as const)(
    'keeps the %s out of the admin-only school profile',
    async (role) => {
      const { headers } = await signIn(role);

      const response = await client.get('/school-profile').set(headers);

      expect(response.status).toBe(403);
    }
  );

  it('resolves the single school and the role of a user on the server', async () => {
    const institution = await createInstitutionFixture('Colegio Central');
    const user = await createUserFixture({
      institutionId: institution.id,
      role: 'vice_director',
    });
    const repository = new AuthRepository(db);

    const context = await repository.findAuthContext(user.id);

    expect(context).toEqual({
      role: 'vice_director',
      institutionId: institution.id,
    });
    expect(await repository.findAuthContext('00000000-0000-4000-8000-00000000dead')).toBeNull();
  });
});
