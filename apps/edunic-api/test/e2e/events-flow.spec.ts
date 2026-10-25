import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import type {
  AttendanceMarkedEvent,
  EnrollmentCreatedEvent,
} from '@edunic/source/domain/events';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import { flushOutbox } from '../helpers/outbox.js';
import {
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 7 (task 3.4, P3-R5 + D2): the events journey. A create made
// through the API must leave its outbox row AND deliver the published
// event to the bus; the published envelope must be the same event the
// outbox recorded. flushOutbox proves nothing was left pending.
describe('E2E flow: events', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let institutionId: string;
  let headers: Record<string, string>;
  let studentId: string;
  let academicPeriodId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    const institution = await createInstitutionFixture('Events Flow Institution');
    institutionId = institution.id;

    const admin = await createUserFixture({
      institutionId,
      role: 'director',
      email: 'e2e-admin@events-flow.test',
      password: 'admin1234',
    });

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: admin.email, password: admin.password, institutionId },
    });
    expect(login.statusCode).toBe(200);

    headers = {
      authorization: `Bearer ${login.json().data.token}`,
      'x-institution-id': institutionId,
    };

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
    academicPeriodId = period.json().data.id;

    const student = await app.inject({
      method: 'POST',
      url: '/students',
      headers,
      payload: { firstName: 'Eva', lastName: 'Mendez', dateOfBirth: '2011-04-19' },
    });
    expect(student.statusCode).toBe(201);
    studentId = student.json().data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes the enrollment event and records the matching outbox row', async () => {
    const received: EnrollmentCreatedEvent[] = [];
    const unsubscribeEnrollment =
      app.eventBus.subscribe<EnrollmentCreatedEvent>(
        'enrollment.created',
        (event) => {
          received.push(event);
        }
      );

    // Different event name: must NOT receive the enrollment event.
    const receivedGrades: AttendanceMarkedEvent[] = [];
    const unsubscribeAttendance =
      app.eventBus.subscribe<AttendanceMarkedEvent>(
        'attendance.marked',
        (event) => {
          receivedGrades.push(event);
        }
      );

    let enrollmentId: string;

    try {
      const created = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers,
        payload: { studentId, academicPeriodId, status: 'active' },
      });

      expect(created.statusCode).toBe(201);
      enrollmentId = created.json().data.id;
    } finally {
      unsubscribeEnrollment();
      unsubscribeAttendance();
    }

    // Published event: delivered on the bus, routed by name, carrying the
    // created row's identity.
    expect(received).toHaveLength(1);
    expect(received[0].name).toBe('enrollment.created');
    expect(received[0]).not.toHaveProperty('institutionId');
    expect(received[0].payload).toMatchObject({
      enrollmentId,
      studentId,
      academicPeriodId,
    });
    expect(receivedGrades).toHaveLength(0);

    // Outbox row: the same event id the bus delivered, marked published.
    const outboxRows = await db.execute(
      sql.raw(
        `SELECT id, event->>'name' AS name, published_at FROM outbox_events`
      )
    );
    expect(outboxRows.rows).toHaveLength(1);
    const outboxRow = outboxRows.rows[0] as {
      id: string;
      name: string;
      published_at: Date | null;
    };
    expect(outboxRow.id).toBe(received[0].id);
    expect(outboxRow.name).toBe('enrollment.created');
    expect(outboxRow.published_at).not.toBeNull();

    // The published event IS the outbox-recorded event, end to end.
    expect(received[0].id).toBe(outboxRow.id);

    // Helper drain contract: the API's publish path left nothing pending,
    // so flushOutbox delivers nothing and never touches the bus.
    const drainSpy = jest.fn();
    const drained = await flushOutbox(drainSpy);

    expect(drained).toBe(0);
    expect(drainSpy).not.toHaveBeenCalled();
  });

  it('publishes a distinct event per journey step with distinct payloads', async () => {
    const received: EnrollmentCreatedEvent[] = [];
    const unsubscribe = app.eventBus.subscribe<EnrollmentCreatedEvent>(
      'enrollment.created',
      (event) => {
        received.push(event);
      }
    );

    let firstEnrollmentId: string;
    let secondEnrollmentId: string;

    try {
      const first = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers,
        payload: { studentId, academicPeriodId, status: 'active' },
      });
      expect(first.statusCode).toBe(201);
      firstEnrollmentId = first.json().data.id;

      const secondPeriod = await app.inject({
        method: 'POST',
        url: '/academic-periods',
        headers,
        payload: {
          year: 2026,
          term: 2,
          startDate: '2026-04-15',
          endDate: '2026-06-30',
        },
      });
      expect(secondPeriod.statusCode).toBe(201);

      const second = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers,
        payload: {
          studentId,
          academicPeriodId: secondPeriod.json().data.id,
          status: 'active',
        },
      });
      expect(second.statusCode).toBe(201);
      secondEnrollmentId = second.json().data.id;
    } finally {
      unsubscribe();
    }

    // Two journeys produced two events with distinct identities and payloads.
    expect(received).toHaveLength(2);
    expect(received.map((event) => event.payload.enrollmentId).sort()).toEqual(
      [firstEnrollmentId, secondEnrollmentId].sort()
    );
    expect(new Set(received.map((event) => event.id)).size).toBe(2);

    // Two outbox rows, both marked published.
    const outboxRows = await db.execute(
      sql.raw(
        `SELECT COUNT(*)::int AS count FROM outbox_events WHERE published_at IS NOT NULL`
      )
    );
    expect((outboxRows.rows[0] as { count: number }).count).toBe(2);
  });
});
