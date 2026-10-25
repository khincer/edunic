import { eq } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { guardianUserLinks, studentGuardians } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('payments routes', () => {
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

  async function createSchool() {
    const institution = await createInstitutionFixture();
    const admin = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });
    const student = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'Jane',
      lastName: 'Doe',
    });
    const otherStudent = await createStudentFixture({
      institutionId: institution.id,
      firstName: 'John',
      lastName: 'Roe',
    });

    return {
      institution,
      student,
      otherStudent,
      adminHeaders: await createAuthHeaders({
        userId: admin.id,
        institutionId: institution.id,
      }),
    };
  }

  it('registers an offline payment with a receipt number', async () => {
    const { student, adminHeaders } = await createSchool();

    const response = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: '  Tuicion Marzo ',
        amountCents: 50000,
        dueDate: '2026-03-01T00:00:00.000Z',
        method: 'cash',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.concept).toBe('Tuicion Marzo');
    expect(response.body.data.amountCents).toBe(50000);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.receiptNumber).toMatch(/^R-\d{6}$/);
    expect(response.body.data.paidAt).toBeNull();
  });

  it('gives every payment its own receipt number', async () => {
    const { student, adminHeaders } = await createSchool();

    const first = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        method: 'cash',
      });
    const second = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Abril',
        amountCents: 50000,
        method: 'cash',
      });

    expect(first.body.data.receiptNumber).not.toBe(
      second.body.data.receiptNumber
    );
  });

  it('refuses a payment for a student that does not exist', async () => {
    const { adminHeaders } = await createSchool();

    const response = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: '00000000-0000-4000-8000-000000000000',
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        method: 'cash',
      });

    expect(response.status).toBe(404);
  });

  it('keeps the ledger away from a teacher', async () => {
    const { institution } = await createSchool();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const headers = await createAuthHeaders({
      userId: teacher.id,
      institutionId: institution.id,
    });

    const response = await client.get('/payments').set(headers);

    expect(response.status).toBe(403);
  });

  it('marks a payment as paid and gives it its date', async () => {
    const { student, adminHeaders } = await createSchool();

    const created = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        method: 'cash',
      });

    const response = await client
      .patch(`/payments/${created.body.data.id}`)
      .set(adminHeaders)
      .send({ status: 'paid' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('paid');
    expect(response.body.data.paidAt).not.toBeNull();
  });

  it('reports the balance and the overdue of every student', async () => {
    const { student, otherStudent, adminHeaders } = await createSchool();

    await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        dueDate: '2020-01-01T00:00:00.000Z',
        method: 'cash',
      });
    await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Abril',
        amountCents: 30000,
        method: 'cash',
        status: 'paid',
      });

    const response = await client.get('/payments/balances').set(adminHeaders);

    expect(response.status).toBe(200);
    const jane = response.body.data.find(
      (row: { studentId: string }) => row.studentId === student.id
    );
    expect(jane.billedCents).toBe(80000);
    expect(jane.paidCents).toBe(30000);
    expect(jane.outstandingCents).toBe(50000);
    expect(jane.overdueCount).toBe(1);

    const john = response.body.data.find(
      (row: { studentId: string }) => row.studentId === otherStudent.id
    );
    expect(john.billedCents).toBe(0);
    expect(john.overdueCount).toBe(0);
  });

  it('shows a parent only the payments of their own children', async () => {
    const { institution, student, otherStudent, adminHeaders } =
      await createSchool();

    await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
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

    const guardian = await createGuardianFixture({
      institutionId: institution.id,
    });
    await db.insert(studentGuardians).values({
      studentId: student.id,
      guardianId: guardian.id,
    });

    const parent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      institutionId: institution.id,
      guardianId: guardian.id,
      userId: parent.id,
    });
    const parentHeaders = await createAuthHeaders({
      userId: parent.id,
      institutionId: institution.id,
    });

    const list = await client.get('/payments').set(parentHeaders);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].studentId).toBe(student.id);
  });

  it('refuses a parent reading the payment of another child', async () => {
    const { institution, otherStudent, adminHeaders } = await createSchool();

    const created = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: otherStudent.id,
        concept: 'Tuicion Abril',
        amountCents: 40000,
        method: 'cash',
      });

    const guardian = await createGuardianFixture({
      institutionId: institution.id,
    });
    const parent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      institutionId: institution.id,
      guardianId: guardian.id,
      userId: parent.id,
    });
    const parentHeaders = await createAuthHeaders({
      userId: parent.id,
      institutionId: institution.id,
    });

    const response = await client
      .get(`/payments/${created.body.data.id}`)
      .set(parentHeaders);

    expect(response.status).toBe(403);
  });
  it('renders the receipt of a payment as a PDF', async () => {
    const { student, adminHeaders } = await createSchool();

    const created = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        method: 'cash',
        status: 'paid',
      });

    const response = await client
      .get(`/payments/${created.body.data.id}/receipt`)
      .set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('gives the parent of the student the receipt', async () => {
    const { institution, student, adminHeaders } = await createSchool();

    const created = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: student.id,
        concept: 'Tuicion Marzo',
        amountCents: 50000,
        method: 'cash',
      });

    const guardian = await createGuardianFixture({
      institutionId: institution.id,
    });
    await db.insert(studentGuardians).values({
      studentId: student.id,
      guardianId: guardian.id,
    });

    const parent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      institutionId: institution.id,
      guardianId: guardian.id,
      userId: parent.id,
    });
    const parentHeaders = await createAuthHeaders({
      userId: parent.id,
      institutionId: institution.id,
    });

    const response = await client
      .get(`/payments/${created.body.data.id}/receipt`)
      .set(parentHeaders);

    expect(response.status).toBe(200);
    expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('refuses a parent the receipt of another child', async () => {
    const { institution, otherStudent, adminHeaders } = await createSchool();

    const created = await client
      .post('/payments')
      .set(adminHeaders)
      .send({
        studentId: otherStudent.id,
        concept: 'Tuicion Abril',
        amountCents: 40000,
        method: 'cash',
      });

    const guardian = await createGuardianFixture({
      institutionId: institution.id,
    });
    const parent = await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      institutionId: institution.id,
      guardianId: guardian.id,
      userId: parent.id,
    });
    const parentHeaders = await createAuthHeaders({
      userId: parent.id,
      institutionId: institution.id,
    });

    const response = await client
      .get(`/payments/${created.body.data.id}/receipt`)
      .set(parentHeaders);

    expect(response.status).toBe(403);
  });

});
