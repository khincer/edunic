import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

async function countEnrollments() {
  const rows = (await db.execute(
    sql.raw('SELECT COUNT(*)::int AS count FROM enrollments')
  )) as unknown as { count: number }[];
  return rows[0].count;
}

describe('outbox atomicity (P2-R6)', () => {
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
    const teacherUser = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    institutionId = institution.id;
    headers = await createAuthHeaders({
      userId: teacherUser.id,
      institutionId: institution.id,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // EXPECTED-RED AGREEMENT (slice S1 -> S2): this assertion must stay skipped
  // until task 2.5 lands the db.transaction() + outbox wrapping for the
  // enrollments service. Do NOT weaken or delete it to keep the suite green;
  // flip it.skip to it as part of task 2.5's GREEN step.
  it.skip('rolls back the enrollment row when event publish fails — TODO(task 2.5/S2): transactional outbox lands there', async () => {
    const student = await createStudentFixture({ institutionId });
    const period = await createAcademicPeriodFixture({ institutionId });
    const classroom = await createClassroomFixture({ institutionId });

    const originalPublish = app.eventBus.publish.bind(app.eventBus);
    app.eventBus.publish = () =>
      Promise.reject(new Error('event bus down (injected)'));

    try {
      const response = await client.post('/enrollments').set(headers).send({
        studentId: student.id,
        academicPeriodId: period.id,
        classroomId: classroom.id,
        status: 'active',
      });

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(await countEnrollments()).toBe(0);
    } finally {
      app.eventBus.publish = originalPublish;
    }
  });
});
