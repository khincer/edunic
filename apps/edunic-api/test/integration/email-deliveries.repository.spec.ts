import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import {
  emailDeliveries,
  guardianUserLinks,
  institutionFeatureFlags,
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

async function linkGuardianUser(
  institutionId: string,
  guardianId: string,
  userId: string
) {
  await db.insert(guardianUserLinks).values({
    institutionId,
    guardianId,
    userId,
  });
}

async function stageDelivery(input: {
  institutionId: string;
  address: string;
  eventName?: string;
  eventId?: string;
  status?: string;
  createdAt: Date;
}) {
  await db.insert(emailDeliveries).values({
    id: randomUUID(),
    institutionId: input.institutionId,
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

  it('resolves the institution-scoped recipient union, normalized and deduped', async () => {
    const institution = await createInstitutionFixture();
    const otherInstitution = await createInstitutionFixture('Other Institution');
    const student = await createStudentFixture({ institutionId: institution.id });
    const otherStudent = await createStudentFixture({
      institutionId: otherInstitution.id,
    });

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
    const foreignGuardian = await createGuardianFixture({
      institutionId: otherInstitution.id,
      email: 'foreign@example.com',
    });

    await linkStudentGuardian(student.id, guardianWithEmail.id);
    await linkStudentGuardian(student.id, guardianWithoutEmail.id);
    await linkStudentGuardian(student.id, secondGuardianWithEmail.id);
    await linkStudentGuardian(otherStudent.id, foreignGuardian.id);

    await linkGuardianUser(institution.id, guardianWithEmail.id, linkedUser.id);
    await linkGuardianUser(
      institution.id,
      guardianWithoutEmail.id,
      secondLinkedUser.id
    );

    const recipients = await repository.resolveRecipients(
      institution.id,
      student.id
    );

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
      institutionId: institution.id,
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
      .where(eq(emailDeliveries.institutionId, institution.id))
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
        institutionId: institution.id,
        eventId: randomUUID(),
        eventName: 'grade.submitted',
        studentId: student.id,
        recipients: [],
      })
    ).resolves.toBeUndefined();

    expect(await db.select().from(emailDeliveries)).toHaveLength(0);
  });

  it('lists a tenant-scoped newest-first page with status and event filters', async () => {
    const institution = await createInstitutionFixture();
    const otherInstitution = await createInstitutionFixture('Other Institution');

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
    await stageDelivery({
      institutionId: otherInstitution.id,
      address: 'foreign@example.com',
      createdAt: new Date('2026-02-04T00:00:00.000Z'),
    });

    const offsetPage = await repository.list({
      institutionId: institution.id,
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
      institutionId: institution.id,
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
      institutionId: institution.id,
      limit: 25,
      offset: 0,
      status: 'failed',
    });

    expect(failedPage.items.map((row) => row.recipientAddress)).toEqual([
      'newest@example.com',
    ]);

    const eventPage = await repository.list({
      institutionId: institution.id,
      limit: 25,
      offset: 0,
      eventName: 'grade.submitted',
    });

    expect(eventPage.items.map((row) => row.recipientAddress)).toEqual([
      'middle@example.com',
      'oldest@example.com',
    ]);
  });

  it('reports the effective flag and sender-identity state per institution', async () => {
    const institution = await createInstitutionFixture();

    await expect(repository.getState(institution.id)).resolves.toEqual({
      emailNotificationsEnabled: false,
      senderIdentityConfigured: false,
    });

    await db.insert(institutionFeatureFlags).values({
      institutionId: institution.id,
      featureKey: 'email_notifications',
      enabled: true,
    });

    await expect(repository.getState(institution.id)).resolves.toEqual({
      emailNotificationsEnabled: true,
      senderIdentityConfigured: false,
    });

    await db
      .update(institutions)
      .set({ senderName: 'Colegio Las Flores' })
      .where(eq(institutions.id, institution.id));

    await expect(repository.getState(institution.id)).resolves.toEqual({
      emailNotificationsEnabled: true,
      senderIdentityConfigured: true,
    });

    await expect(repository.getState(randomUUID())).resolves.toBeNull();
  });
});
