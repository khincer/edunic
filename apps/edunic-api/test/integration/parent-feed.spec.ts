import { eq } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import {
  assignments,
  guardianUserLinks,
  studentGuardians,
} from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createAcademicPeriodFixture,
  createClassroomFixture,
  createEnrollmentFixture,
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('parent feed', () => {
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

  // One school, two families: the parent of the first family must never see
  // the second one.
  async function createSchool() {
    await createInstitutionFixture();
    const classroom = await createClassroomFixture({});
    const period = await createAcademicPeriodFixture({});

    const myStudent = await createStudentFixture({
      firstName: 'Jane',
      firstLastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      firstName: 'John',
      firstLastName: 'Roe',
    });

    const myEnrollment = await createEnrollmentFixture({
      studentId: myStudent.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
    });
    const otherEnrollment = await createEnrollmentFixture({
      studentId: otherStudent.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
    });

    const admin = await createUserFixture({
      role: 'director',
    });
    const adminHeaders = await createAuthHeaders({
      userId: admin.id,
    });

    const guardian = await createGuardianFixture({});
    await db.insert(studentGuardians).values({
      studentId: myStudent.id,
      guardianId: guardian.id,
    });

    const parent = await createUserFixture({
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      guardianId: guardian.id,
      userId: parent.id,
    });

    return {
      classroom,
      myStudent,
      otherStudent,
      myEnrollment,
      otherEnrollment,
      adminHeaders,
      parentHeaders: await createAuthHeaders({
        userId: parent.id,
      }),
    };
  }

  it('shows the parent the payments of their own child', async () => {
    const { myStudent, otherStudent, adminHeaders, parentHeaders } =
      await createSchool();

    await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: myStudent.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        dueDate: '2026-03-01T00:00:00.000Z',
        method: 'cash',
      });
    await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: otherStudent.id,
        concept: 'Tuicion Abril',
        amountCents: 40000,
        method: 'cash',
      });

    const response = await client.get('/dashboard/parent').set(parentHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data.payments).toHaveLength(1);
    expect(response.body.data.payments[0].studentId).toBe(myStudent.id);
    expect(response.body.data.payments[0].concept).toBe('Tuicion Marzo');

    // The balance of the child, and only of the child.
    const balance = response.body.data.balances.find(
      (row: { studentId: string }) => row.studentId === myStudent.id
    );
    expect(balance.outstandingCents).toBe(50000);
    expect(
      response.body.data.balances.some(
        (row: { studentId: string }) => row.studentId === otherStudent.id
      )
    ).toBe(false);
  });

  it('shows the parent the pending exams of their child', async () => {
    const { classroom, adminHeaders, parentHeaders } =
      await createSchool();

    await db.insert(assignments).values({
      id: '77777777-0000-4000-8000-000000000001',
      classroomId: classroom.id,
      title: 'Examen de Matematicas',
      type: 'exam',
      status: 'published',
      dueDate: new Date('2026-04-01T00:00:00.000Z'),
    });

    const response = await client.get('/dashboard/parent').set(parentHeaders);

    expect(response.status).toBe(200);
    const exams = response.body.data.upcomingAssignments.filter(
      (assignment: { type: string }) => assignment.type === 'exam'
    );
    expect(exams).toHaveLength(1);
    expect(exams[0].title).toBe('Examen de Matematicas');
  });
});
