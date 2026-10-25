import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import {
  emailDeliveries,
  guardianUserLinks,
  featureFlags,
  institutions,
  studentGuardians,
} from '@edunic/source/db/schema';
import { EmailDeliveriesRepository } from '@edunic/source/domain/notifications';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

async function linkStudentGuardian(studentId: string, guardianId: string) {
  await db.insert(studentGuardians).values({ studentId, guardianId });
}

async function linkGuardianUser(guardianId: string, userId: string) {
  await db.insert(guardianUserLinks).values({ guardianId, userId });
}

async function stageDelivery(input: {
  address: string;
  eventName?: string;
  eventId?: string;
  status?: string;
  createdAt: Date;
}) {
  await db.insert(emailDeliveries).values({
    id: randomUUID(),
    eventId: input.eventId ?? randomUUID(),
    eventName: input.eventName ?? 'grade.submitted',
    recipientAddress: input.address,
    recipientSource: 'guardian',
    status: input.status ?? 'queued',
    createdAt: input.createdAt,
  });
}

describe('EmailDeliveriesRepository', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let repository: EmailDeliveriesRepository;

  beforeAll(async () => {
    app = await createTestApp();
    repository = new EmailDeliveriesRepository(app.db);
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves the recipient union, normalized and deduped', async () => {
    const institution = await createInstitutionFixture();
    const student = await createStudentFixture({ institutionId: institution.id });

    const guardianWithEmail = await createGuardianFixture({
      institutionId: institution.id,
      email: '  Maria@Example.com ',
    });
    const guardianWithoutEmail = await createGuardianFixture({
      institutionId: institution.id,
      email: null,
    });
    const secondGuardianWithEmail = await createGuardianFixture({
      institutionId: institution.id,
      email: 'other@example.com',
    });
    const linkedUser = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
      email: 'maria@example.com',
    });
    const secondLinkedUser = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
      email: ' Dad@Example.com',
    });

    await linkStudentGuardian(student.id, guardianWithEmail.id);
    await linkStudentGuardian(student.id, guardianWithoutEmail.id);
    await linkStudentGuardian(student.id, secondGuardianWithEmail.id);

    await linkGuardianUser(guardianWithEmail.id, linkedUser.id);
    await linkGuardianUser(guardianWithoutEmail.id, secondLinkedUser.id);

    const recipients = await repository.resolveRecipients(student.id);

    expect(recipients).toEqual([
      { address: 'dad@example.com', source: 'user' },
      { address: 'maria@example.com', source: 'guardian' },
      { address: 'other@example.com', source: 'guardian' },
    ]);
  });

  it('stages queued ledger rows and swallows a redelivered event', async () => {
    const institution = await createInstitutionFixture();
    const student = await createStudentFixture({ institutionId: institution.id });
    const eventId = randomUUID();
    const input = {
      eventId,
      eventName: 'grade.submitted',
      studentId: student.id,
      recipients: [
        { address: 'maria@example.com', source: 'guardian' as const },
        { address: 'dad@example.com', source: 'user' as const },
      ],
    };

    await repository.insertPending(input);
    await repository.insertPending(input);

    const firstEventRows = await db
      .select()
      .from(emailDeliveries)
      .orderBy(emailDeliveries.recipientAddress);

    expect(firstEventRows).toHaveLength(2);
    expect(
      firstEventRows.map((row) => [
        row.recipientAddress,
        row.recipientSource,
        row.status,
        row.attemptCount,
        row.eventName,
      ])
    ).toEqual([
      ['dad@example.com', 'user', 'queued', 0, 'grade.submitted'],
      ['maria@example.com', 'guardian', 'queued', 0, 'grade.submitted'],
    ]);

    // The same address for a different event is a second delivery (A5).
    await repository.insertPending({
      ...input,
      eventId: randomUUID(),
      eventName: 'attendance.marked',
      recipients: [{ address: 'maria@example.com', source: 'guardian' }],
    });

    const rows = await db.select().from(emailDeliveries);
    expect(rows).toHaveLength(3);
  });

  it('treats an empty recipient list as a no-op', async () => {
    const institution = await createInstitutionFixture();
    const student = await createStudentFixture({ institutionId: institution.id });

    await expect(
      repository.insertPending({
        eventId: randomUUID(),
        eventName: 'grade.submitted',
        studentId: student.id,
        recipients: [],
      })
    ).resolves.toBeUndefined();

    expect(await db.select().from(emailDeliveries)).toHaveLength(0);
  });

  it('lists a newest-first page with status and event filters', async () => {
    // The 0014 default fills institution_id, so a bare insert needs the school.
    await createInstitutionFixture();

    await stageDelivery({
      address: 'oldest@example.com',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    await stageDelivery({
      address: 'middle@example.com',
      createdAt: new Date('2026-02-02T00:00:00.000Z'),
    });
    await stageDelivery({
      address: 'newest@example.com',
      eventName: 'attendance.marked',
      status: 'failed',
      createdAt: new Date('2026-02-03T00:00:00.000Z'),
    });

    const offsetPage = await repository.list({
      limit: 2,
      offset: 0,
    });

    expect(offsetPage.items.map((row) => row.recipientAddress)).toEqual([
      'newest@example.com',
      'middle@example.com',
    ]);
    expect(offsetPage.total).toBe(3);

    // Keyset mode fetches one sentinel row past the limit (pagination.ts).
    const cursorPage = await repository.list({
      limit: 2,
      cursor: 'start',
      offset: 0,
    });

    expect(cursorPage.items.map((row) => row.recipientAddress)).toEqual([
      'newest@example.com',
      'middle@example.com',
      'oldest@example.com',
    ]);
    expect(cursorPage.total).toBeUndefined();

    const failedPage = await repository.list({
      limit: 25,
      offset: 0,
      status: 'failed',
    });

    expect(failedPage.items.map((row) => row.recipientAddress)).toEqual([
      'newest@example.com',
    ]);

    const eventPage = await repository.list({
      limit: 25,
      offset: 0,
      eventName: 'grade.submitted',
    });

    expect(eventPage.items.map((row) => row.recipientAddress)).toEqual([
      'middle@example.com',
      'oldest@example.com',
    ]);
  });

  it('reports the effective flag and sender-identity state of the single school', async () => {
    await expect(repository.getState()).resolves.toBeNull();

    const institution = await createInstitutionFixture();

    await expect(repository.getState()).resolves.toEqual({
      emailNotificationsEnabled: false,
      senderIdentityConfigured: false,
    });

    await db
      .update(featureFlags)
      .set({ defaultValue: true })
      .where(eq(featureFlags.key, 'email_notifications'));

    await expect(repository.getState()).resolves.toEqual({
      emailNotificationsEnabled: true,
      senderIdentityConfigured: false,
    });

    await db
      .update(institutions)
      .set({ senderName: 'Colegio Las Flores' })
      .where(eq(institutions.id, institution.id));

    await expect(repository.getState()).resolves.toEqual({
      emailNotificationsEnabled: true,
      senderIdentityConfigured: true,
    });
  });
});
