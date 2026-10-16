import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { students } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

const studentBody = {
  firstName: 'Idem',
  lastName: 'Potency',
  dateOfBirth: '2014-05-01',
};

async function countStudents() {
  const result = await db.select({ id: students.id }).from(students);
  return result.length;
}

describe('idempotency plugin', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let institutionId: string;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });

    institutionId = institution.id;
    headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('replays the original response without re-executing the handler', async () => {
    const key = randomUUID();

    const first = await client
      .post('/students')
      .set(headers)
      .set('idempotency-key', key)
      .send(studentBody);

    expect(first.status).toBe(201);
    const firstId = first.body.data.id;

    const replay = await client
      .post('/students')
      .set(headers)
      .set('idempotency-key', key)
      .send(studentBody);

    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);
    expect(await countStudents()).toBe(1);
    expect(replay.body.data.id).toBe(firstId);
  });

  it('rejects a concurrent duplicate with 409 IDEMPOTENCY_CONFLICT', async () => {
    const key = randomUUID();

    const [first, second] = await Promise.all([
      client
        .post('/students')
        .set(headers)
        .set('idempotency-key', key)
        .send(studentBody),
      client
        .post('/students')
        .set(headers)
        .set('idempotency-key', key)
        .send(studentBody),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await countStudents()).toBe(1);
  });

  it('executes normally when requests carry different keys or actors', async () => {
    const otherAdmin = await createUserFixture({
      institutionId,
      role: 'admin',
    });
    const otherHeaders = await createAuthHeaders({
      userId: otherAdmin.id,
      institutionId,
    });
    // Random per-run key: fixture IDs are deterministic per spec file, so a
    // fixed literal would replay against 24h-TTL Redis entries from earlier
    // runs of the same suite.
    const sharedKey = randomUUID();

    const sameKeyDifferentActor = await client
      .post('/students')
      .set(headers)
      .set('idempotency-key', randomUUID())
      .send(studentBody);
    const secondActor = await client
      .post('/students')
      .set(otherHeaders)
      .set('idempotency-key', sharedKey)
      .send(studentBody);
    const firstActor = await client
      .post('/students')
      .set(headers)
      .set('idempotency-key', sharedKey)
      .send(studentBody);

    expect(sameKeyDifferentActor.status).toBe(201);
    expect(secondActor.status).toBe(201);
    expect(firstActor.status).toBe(201);
    expect(await countStudents()).toBe(3);
  });

  it('leaves /health and /docs untouched (no idempotency processing)', async () => {
    const health = await client
      .get('/health')
      .set('idempotency-key', randomUUID());

    expect(health.status).toBe(200);
    expect(health.headers['idempotency-replayed']).toBeUndefined();
  });
});

describe('idempotency plugin with Redis unavailable', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let client: ReturnType<typeof createHttpClient>;
  let institutionId: string;
  let headers: Record<string, string>;
  const previousUrl = process.env.IDEMPOTENCY_REDIS_URL;

  beforeAll(async () => {
    // Dead port: connection refused, exercises the Redis-down degradation path.
    process.env.IDEMPOTENCY_REDIS_URL = 'redis://127.0.0.1:6399';
    app = await createTestApp();
    client = createHttpClient(app);
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const institution = await createInstitutionFixture();
    const adminUser = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });

    institutionId = institution.id;
    headers = await createAuthHeaders({
      userId: adminUser.id,
      institutionId: institution.id,
    });
  });

  afterAll(async () => {
    await app.close();
    if (previousUrl === undefined) {
      delete process.env.IDEMPOTENCY_REDIS_URL;
    } else {
      process.env.IDEMPOTENCY_REDIS_URL = previousUrl;
    }
  });

  it('still executes mutating requests when Redis is down', async () => {
    const key = randomUUID();

    const first = await client
      .post('/students')
      .set(headers)
      .set('idempotency-key', key)
      .send(studentBody);
    const second = await client
      .post('/students')
      .set(headers)
      .set('idempotency-key', key)
      .send(studentBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await countStudents()).toBe(2);
  });
});
