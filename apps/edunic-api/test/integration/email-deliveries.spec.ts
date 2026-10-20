import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '@edunic/source/db';
import {
  emailDeliveries,
  institutionFeatureFlags,
  institutions,
} from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

async function stageDelivery(input: {
  institutionId: string;
  address: string;
  eventName?: string;
  status?: string;
  createdAt: Date;
}) {
  await db.insert(emailDeliveries).values({
    id: randomUUID(),
    institutionId: input.institutionId,
    eventId: randomUUID(),
    eventName: input.eventName ?? 'grade.submitted',
    recipientAddress: input.address,
    recipientSource: 'guardian',
    status: input.status ?? 'queued',
    createdAt: input.createdAt,
  });
}

async function enableEmailNotifications(institutionId: string) {
  await db.insert(institutionFeatureFlags).values({
    institutionId,
    featureKey: 'email_notifications',
    enabled: true,
  });
}

// PN-R2 route inventory: the printed route table is the structural proof that
// the panel is read-only. Fastify prints a radix tree whose segments are
// parent-relative, so locate the `/deliveries` node and keep every deeper line
// (its subtree) to inventory the methods the panel actually exposes.
function notificationSubtreeLines(app: FastifyInstance) {
  const lines = app.printRoutes({ commonPrefix: false }).split('\n');

  const indentOf = (line: string) =>
    (/^(?:[│ ]{3})*/.exec(line)?.[0] ?? '').length;
  // Anchor on the /notifications branch: the first "/deliveries" line
  // in the whole tree belongs to whichever node happens to come first, and
  // that moves as unrelated routes are added.
  const index = lines.findIndex((line) => /\/notifications(?: \(|$)/.test(line));

  if (index === -1) {
    return [];
  }

  const baseIndent = indentOf(lines[index]);

  return lines
    .slice(index)
    .filter((line, offset) => offset === 0 || indentOf(line) > baseIndent);
}

describe('email deliveries admin panel', () => {
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

  it('lists the institution ledger newest-first with the CursorPage envelope', async () => {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    await stageDelivery({
      institutionId: institution.id,
      address: 'oldest@example.com',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await stageDelivery({
      institutionId: institution.id,
      address: 'middle@example.com',
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
    });
    await stageDelivery({
      institutionId: institution.id,
      address: 'newest@example.com',
      eventName: 'attendance.marked',
      status: 'failed',
      createdAt: new Date('2026-02-03T00:00:00.000Z'),
    });

    const offsetResponse = await client
      .get('/notifications/deliveries?limit=2')
      .set(headers);

    expect(offsetResponse.status).toBe(200);
    expect(offsetResponse.headers['x-pagination-deprecated']).toBe('offset');
    expect(
      offsetResponse.body.data.map(
        (row: { recipientAddress: string }) => row.recipientAddress
      )
    ).toEqual(['newest@example.com', 'middle@example.com']);
    expect(offsetResponse.body.meta.total).toBe(3);
    expect(offsetResponse.body.hasMore).toBe(true);
    expect(offsetResponse.body.nextCursor).toBeDefined();
    expect(offsetResponse.body.data[0]).toEqual(
      expect.objectContaining({
        eventName: 'attendance.marked',
        status: 'failed',
        attemptCount: 0,
        recipientSource: 'guardian',
        institutionId: institution.id,
      })
    );

    const firstPage = await client
      .get('/notifications/deliveries?limit=2&cursor=start')
      .set(headers);

    expect(firstPage.status).toBe(200);
    expect(firstPage.headers['x-pagination-deprecated']).toBeUndefined();
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.hasMore).toBe(true);
    expect(firstPage.body.meta).toBeUndefined();

    const secondPage = await client
      .get(
        `/notifications/deliveries?limit=2&cursor=${encodeURIComponent(
          firstPage.body.nextCursor
        )}`
      )
      .set(headers);

    expect(
      secondPage.body.data.map(
        (row: { recipientAddress: string }) => row.recipientAddress
      )
    ).toEqual(['oldest@example.com']);
    expect(secondPage.body.hasMore).toBe(false);
    expect(secondPage.body.nextCursor).toBeUndefined();
  });

  it('filters by status and eventName and rejects unknown statuses', async () => {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    await stageDelivery({
      institutionId: institution.id,
      address: 'grade@example.com',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await stageDelivery({
      institutionId: institution.id,
      address: 'failed@example.com',
      eventName: 'attendance.marked',
      status: 'failed',
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
    });

    const statusResponse = await client
      .get('/notifications/deliveries?status=failed')
      .set(headers);

    expect(
      statusResponse.body.data.map(
        (row: { recipientAddress: string }) => row.recipientAddress
      )
    ).toEqual(['failed@example.com']);

    const eventResponse = await client
      .get('/notifications/deliveries?eventName=grade.submitted')
      .set(headers);

    expect(
      eventResponse.body.data.map(
        (row: { recipientAddress: string }) => row.recipientAddress
      )
    ).toEqual(['grade@example.com']);

    const invalidResponse = await client
      .get('/notifications/deliveries?status=unknown')
      .set(headers);

    expect(invalidResponse.status).toBe(400);
  });

  it('reports the effective flag and sender-identity state', async () => {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    const disabledResponse = await client
      .get('/notifications/deliveries/state')
      .set(headers);

    expect(disabledResponse.status).toBe(200);
    expect(disabledResponse.body.data).toEqual({
      emailNotificationsEnabled: false,
      senderIdentityConfigured: false,
    });

    await enableEmailNotifications(institution.id);
    await db
      .update(institutions)
      .set({ senderName: 'Colegio Las Flores' })
      .where(eq(institutions.id, institution.id));

    const enabledResponse = await client
      .get('/notifications/deliveries/state')
      .set(headers);

    expect(enabledResponse.body.data).toEqual({
      emailNotificationsEnabled: true,
      senderIdentityConfigured: true,
    });
  });

  it('rejects non-admin roles on both delivery endpoints', async () => {
    const institution = await createInstitutionFixture();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const parent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    const teacherHeaders = await createAuthHeaders({
      userId: teacher.id,
      institutionId: institution.id,
    });
    const parentHeaders = await createAuthHeaders({
      userId: parent.id,
      institutionId: institution.id,
    });

    for (const headers of [teacherHeaders, parentHeaders]) {
      const listResponse = await client
        .get('/notifications/deliveries')
        .set(headers);
      const stateResponse = await client
        .get('/notifications/deliveries/state')
        .set(headers);

      expect(listResponse.status).toBe(403);
      expect(stateResponse.status).toBe(403);
    }
  });

  it('never exposes another institution rows', async () => {
    const institution = await createInstitutionFixture('School A');
    const otherInstitution = await createInstitutionFixture('School B');
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    await stageDelivery({
      institutionId: institution.id,
      address: 'own@example.com',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await stageDelivery({
      institutionId: otherInstitution.id,
      address: 'foreign@example.com',
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
    });

    const response = await client
      .get('/notifications/deliveries')
      .set(headers);

    expect(response.status).toBe(200);
    expect(
      response.body.data.map(
        (row: { recipientAddress: string }) => row.recipientAddress
      )
    ).toEqual(['own@example.com']);
    expect(response.body.meta.total).toBe(1);
    expect(JSON.stringify(response.body)).not.toContain('foreign@example.com');
  });

  it('keeps the panel visible and lists rows while the flag is off', async () => {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    await stageDelivery({
      institutionId: institution.id,
      address: 'queued@example.com',
      status: 'queued',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    const listResponse = await client
      .get('/notifications/deliveries')
      .set(headers);
    const stateResponse = await client
      .get('/notifications/deliveries/state')
      .set(headers);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(stateResponse.status).toBe(200);
    expect(stateResponse.body.data.emailNotificationsEnabled).toBe(false);
  });

  it('exposes no mutating route under /notifications/deliveries', async () => {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'admin',
    });
    const headers = await createAuthHeaders({
      userId: admin.id,
      institutionId: institution.id,
    });

    const subtree = notificationSubtreeLines(app);

    // The deliveries node itself: read-only, GET and HEAD.
    const deliveriesLine = subtree.find((line) =>
      /\/deliveries(?: \(|$)/.test(line)
    );
    expect(deliveriesLine).toContain('/deliveries (GET, HEAD)');
    expect([
      ...new Set(
        ((deliveriesLine ?? '').match(/\(([^)]*)\)/)?.[1] ?? '')
          .split(', ')
          .filter(Boolean)
      ),
    ]).toEqual(['GET', 'HEAD']);

    expect(subtree.some((line) => line.includes('/state (GET, HEAD)'))).toBe(
      true
    );

    const mutationResponses = [
      await client.post('/notifications/deliveries').set(headers),
      await client.patch('/notifications/deliveries').set(headers),
      await client.put('/notifications/deliveries').set(headers),
      await client.delete('/notifications/deliveries').set(headers),
      await client.post('/notifications/deliveries/state').set(headers),
      await client.patch('/notifications/deliveries/state').set(headers),
      await client.put('/notifications/deliveries/state').set(headers),
      await client.delete('/notifications/deliveries/state').set(headers),
    ];

    expect(mutationResponses.map((response) => response.status)).toEqual([
      404, 404, 404, 404, 404, 404, 404, 404,
    ]);
  });
});
