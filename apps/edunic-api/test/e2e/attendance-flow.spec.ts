import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import type { AttendanceMarkedEvent } from '@edunic/source/domain/events';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 3 (task 3.3, P3-R5): admin logs in, builds the academic chain
// through the API (period -> student -> enrollment), then marks attendance.
// P3-R5's canonical scenario: attendance marked => row + event.
const FAKE_ENROLLMENT_ID = '00000000-0000-4000-8000-000000000000';

describe('E2E flow: attendance', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { email: string; password: string };
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await createInstitutionFixture('Attendance Flow Institution');

    admin = await createUserFixture({
      role: 'director',
      email: 'e2e-admin@attendance-flow.test',
      password: 'admin1234',
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: admin.email, password: admin.password },
    });
    expect(login.statusCode).toBe(200);

    headers = {
      authorization: `Bearer ${login.json().data.token}`,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  async function buildEnrollmentViaApi() {
    const period = await app.inject({
      method: 'POST',
      url: '/academic-periods',
      headers,
      payload: {
        year: 2026,
        term: 1,
        startDate: '2026-01-15',
        endDate: '2026-03-31',
      },
    });
    expect(period.statusCode).toBe(201);

    const student = await app.inject({
      method: 'POST',
      url: '/students',
      headers,
      payload: { firstName: 'Mia', lastName: 'Torres', dateOfBirth: '2013-09-02' },
    });
    expect(student.statusCode).toBe(201);

    const enrollment = await app.inject({
      method: 'POST',
      url: '/enrollments',
      headers,
      payload: {
        studentId: student.json().data.id,
        academicPeriodId: period.json().data.id,
        status: 'active',
      },
    });
    expect(enrollment.statusCode).toBe(201);

    return enrollment.json().data.id as string;
  }

  it('marks attendance through the API: response row, outbox row, and published event', async () => {
    const enrollmentId = await buildEnrollmentViaApi();

    const received: AttendanceMarkedEvent[] = [];
    const unsubscribe = app.eventBus.subscribe<AttendanceMarkedEvent>(
      'attendance.marked',
      (event) => {
        received.push(event);
      }
    );

    try {
      const marked = await app.inject({
        method: 'POST',
        url: '/attendance',
        headers,
        payload: { enrollmentId, date: '2026-02-10', status: 'present' },
      });

      expect(marked.statusCode).toBe(201);
      expect(marked.json().data).toMatchObject({
        enrollmentId,
        status: 'present',
      });
      const attendanceId = marked.json().data.id;

      // The published event reached the bus with the created row's identity.
      expect(received).toHaveLength(1);
      expect(received[0].name).toBe('attendance.marked');
      expect(received[0]).not.toHaveProperty('institutionId');
      expect(received[0].payload).toMatchObject({
        attendanceId,
        enrollmentId,
        status: 'present',
      });
    } finally {
      unsubscribe();
    }

    // DB state: the attendance row and its outbox event both exist. The
    // journey's earlier API enrollment left its own outbox row too.
    const attendanceRows = await db.execute(
      sql.raw('SELECT enrollment_id, status FROM attendance')
    );
    expect(attendanceRows.rows).toEqual([
      { enrollment_id: enrollmentId, status: 'present' },
    ]);

    const outboxRows = await db.execute(
      sql.raw(`SELECT event->>'name' AS name FROM outbox_events ORDER BY name`)
    );
    expect(outboxRows.rows).toEqual([
      { name: 'attendance.marked' },
      { name: 'enrollment.created' },
    ]);
  });

  it('answers NOT_FOUND and writes nothing when the enrollment does not exist', async () => {
    const marked = await app.inject({
      method: 'POST',
      url: '/attendance',
      headers,
      payload: {
        enrollmentId: FAKE_ENROLLMENT_ID,
        date: '2026-02-11',
        status: 'absent',
      },
    });

    expect(marked.statusCode).toBe(404);
    const body = marked.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('Enrollment not found');
    expect(typeof body.correlationId).toBe('string');

    // The failed journey left neither an attendance row nor an outbox event.
    const attendanceCount = await db.execute(
      sql.raw('SELECT COUNT(*)::int AS count FROM attendance')
    );
    expect((attendanceCount.rows[0] as { count: number }).count).toBe(0);
    const outboxCount = await db.execute(
      sql.raw('SELECT COUNT(*)::int AS count FROM outbox_events')
    );
    expect((outboxCount.rows[0] as { count: number }).count).toBe(0);
  });
});
