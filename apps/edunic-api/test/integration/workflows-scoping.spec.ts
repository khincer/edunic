import { eq } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import {
  guardianUserLinks,
  messages,
  notifications,
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
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// Assignments, school events and messages (ASG-01, EVT-02, ROLE-04, PAR-04):
// a teacher writes and reads only their own classrooms, a parent reads only
// their own children's classrooms, and messages are private to the sender and
// the recipient. The responses name no school (AUTH-05).
describe('workflows scoping', () => {
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

  // One school, two classrooms: the teacher teaches "mine" and the parent has a
  // child enrolled there. A second teacher and a stray parent own nothing.
  async function createSchool() {
    await createInstitutionFixture();
    const mine = await createClassroomFixture({
      gradeLevel: 5,
      section: 'A',
    });
    const other = await createClassroomFixture({
      gradeLevel: 6,
      section: 'B',
    });
    const period = await createAcademicPeriodFixture({});
    const student = await createStudentFixture({});
    await createEnrollmentFixture({
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: mine.id,
    });
    const guardian = await createGuardianFixture({});
    await db
      .insert(studentGuardians)
      .values({ studentId: student.id, guardianId: guardian.id });

    const parent = await createUserFixture({
      role: 'parent',
    });
    await db.insert(guardianUserLinks).values({
      guardianId: guardian.id,
      userId: parent.id,
    });
    const strayParent = await createUserFixture({
      role: 'parent',
    });
    const teacher = await createUserFixture({
      role: 'teacher',
    });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: mine.id,
    });
    const otherTeacher = await createUserFixture({
      role: 'teacher',
    });
    const admin = await createUserFixture({
      role: 'director',
    });

    const headersFor = (userId: string) =>
      createAuthHeaders({ userId });

    return {
      mine,
      other,
      parent,
      strayParent,
      teacher,
      otherTeacher,
      admin,
      parentHeaders: await headersFor(parent.id),
      strayHeaders: await headersFor(strayParent.id),
      teacherHeaders: await headersFor(teacher.id),
      otherTeacherHeaders: await headersFor(otherTeacher.id),
      adminHeaders: await headersFor(admin.id),
    };
  }

  const startsAt = '2026-03-01T10:00:00.000Z';

  describe('assignments', () => {
    async function seedAssignments() {
      const school = await createSchool();
      for (const [title, classroomId] of [
        ['In mine', school.mine.id],
        ['In other', school.other.id],
      ] as const) {
        const response = await client
          .post('/assignments')
          .set(school.adminHeaders)
          .send({ classroomId, title });
        expect(response.status).toBe(201);
      }
      return school;
    }

    const titles = (body: { data: { title: string }[] }) =>
      body.data.map((row) => row.title).sort();

    it('creates an assignment without exposing a school field and notifies', async () => {
      const school = await createSchool();

      const response = await client
        .post('/assignments')
        .set(school.teacherHeaders)
        .send({ classroomId: school.mine.id, title: ' Fractions ' });

      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('Fractions');
      expect(response.body.data.classroomName).toBe('Grade 5 A');
      expect(response.body.data).not.toHaveProperty('institutionId');

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventName, 'assignment.created'));
      expect(rows).toHaveLength(1);
    });

    it('lets a teacher write only in their own classroom (ASG-01)', async () => {
      const school = await createSchool();

      const foreign = await client
        .post('/assignments')
        .set(school.teacherHeaders)
        .send({ classroomId: school.other.id, title: 'Nope' });
      const noClassroom = await client
        .post('/assignments')
        .set(school.teacherHeaders)
        .send({ title: 'Nope' });
      const unknown = await client
        .post('/assignments')
        .set(school.teacherHeaders)
        .send({
          classroomId: '00000000-0000-4000-8000-000000000999',
          title: 'Nope',
        });
      const parent = await client
        .post('/assignments')
        .set(school.parentHeaders)
        .send({ classroomId: school.mine.id, title: 'Nope' });

      expect(foreign.status).toBe(403);
      expect(noClassroom.status).toBe(403);
      expect(unknown.status).toBe(404);
      expect(parent.status).toBe(403);
    });

    it('refuses a teacher updating an assignment of another classroom', async () => {
      const school = await seedAssignments();
      const list = await client.get('/assignments').set(school.adminHeaders);
      const foreign = list.body.data.find(
        (row: { title: string }) => row.title === 'In other'
      );
      const own = list.body.data.find(
        (row: { title: string }) => row.title === 'In mine'
      );

      const denied = await client
        .patch(`/assignments/${foreign.id}`)
        .set(school.teacherHeaders)
        .send({ title: 'Hijack' });
      const moved = await client
        .patch(`/assignments/${own.id}`)
        .set(school.teacherHeaders)
        .send({ classroomId: school.other.id });
      // Product rule: a teacher update must name one of their classrooms,
      // otherwise it is refused as school-wide (403).
      const schoolWide = await client
        .patch(`/assignments/${own.id}`)
        .set(school.teacherHeaders)
        .send({ title: 'Renamed' });
      const allowed = await client
        .patch(`/assignments/${own.id}`)
        .set(school.teacherHeaders)
        .send({ classroomId: school.mine.id, title: 'Renamed' });

      expect(denied.status).toBe(403);
      expect(moved.status).toBe(403);
      expect(schoolWide.status).toBe(403);
      expect(allowed.status).toBe(200);
      expect(allowed.body.data.title).toBe('Renamed');
      expect(allowed.body.data).not.toHaveProperty('institutionId');
    });

    it('scopes the list by caller and omits the school field', async () => {
      const school = await seedAssignments();

      const admin = await client.get('/assignments').set(school.adminHeaders);
      const teacher = await client.get('/assignments').set(school.teacherHeaders);
      const otherTeacher = await client
        .get('/assignments')
        .set(school.otherTeacherHeaders);
      const parent = await client.get('/assignments').set(school.parentHeaders);
      const stray = await client.get('/assignments').set(school.strayHeaders);

      expect(titles(admin.body)).toEqual(['In mine', 'In other']);
      expect(titles(teacher.body)).toEqual(['In mine']);
      expect(titles(otherTeacher.body)).toEqual([]);
      expect(titles(parent.body)).toEqual(['In mine']);
      expect(titles(stray.body)).toEqual([]);
      expect(admin.body.data[0]).not.toHaveProperty('institutionId');
    });
  });

  describe('school events', () => {
    async function seedEvents() {
      const school = await createSchool();
      for (const [title, classroomId] of [
        ['In mine', school.mine.id],
        ['In other', school.other.id],
        ['School wide', undefined],
      ] as const) {
        const response = await client
          .post('/school-events')
          .set(school.adminHeaders)
          .send({ classroomId, title, startsAt });
        expect(response.status).toBe(201);
      }
      return school;
    }

    const titles = (body: { data: { title: string }[] }) =>
      body.data.map((row) => row.title).sort();

    it('creates an event without exposing a school field and notifies', async () => {
      const school = await createSchool();

      const response = await client
        .post('/school-events')
        .set(school.teacherHeaders)
        .send({
          classroomId: school.mine.id,
          title: 'Birthday',
          eventType: 'exam',
          startsAt,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.classroomName).toBe('Grade 5 A');
      expect(response.body.data).not.toHaveProperty('institutionId');

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventName, 'exam.scheduled'));
      expect(rows).toHaveLength(1);
    });

    it('lets a teacher write only in their own classroom (EVT-02)', async () => {
      const school = await createSchool();

      const foreign = await client
        .post('/school-events')
        .set(school.teacherHeaders)
        .send({ classroomId: school.other.id, title: 'Nope', startsAt });
      const schoolWide = await client
        .post('/school-events')
        .set(school.teacherHeaders)
        .send({ title: 'Nope', startsAt });
      const parent = await client
        .post('/school-events')
        .set(school.parentHeaders)
        .send({ classroomId: school.mine.id, title: 'Nope', startsAt });
      const admin = await client
        .post('/school-events')
        .set(school.adminHeaders)
        .send({ title: 'Open day', startsAt });

      expect(foreign.status).toBe(403);
      expect(schoolWide.status).toBe(403);
      expect(parent.status).toBe(403);
      expect(admin.status).toBe(201);
    });

    it('scopes the list by caller and omits the school field', async () => {
      const school = await seedEvents();

      const admin = await client.get('/school-events').set(school.adminHeaders);
      const teacher = await client
        .get('/school-events')
        .set(school.teacherHeaders);
      const otherTeacher = await client
        .get('/school-events')
        .set(school.otherTeacherHeaders);
      const parent = await client
        .get('/school-events')
        .set(school.parentHeaders);
      const stray = await client.get('/school-events').set(school.strayHeaders);

      expect(titles(admin.body)).toEqual(['In mine', 'In other', 'School wide']);
      expect(titles(teacher.body)).toEqual(['In mine', 'School wide']);
      expect(titles(otherTeacher.body)).toEqual(['School wide']);
      expect(titles(parent.body)).toEqual(['In mine', 'School wide']);
      expect(titles(stray.body)).toEqual(['School wide']);
      expect(admin.body.data[0]).not.toHaveProperty('institutionId');
    });
  });

  describe('messages', () => {
    it('keeps a thread private to its sender and recipient', async () => {
      const school = await createSchool();

      const sent = await client
        .post('/messages')
        .set(school.teacherHeaders)
        .send({
          recipientUserId: school.parent.id,
          subject: ' Hello ',
          body: 'About the exam',
        });

      expect(sent.status).toBe(201);
      expect(sent.body.data.subject).toBe('Hello');
      expect(sent.body.data).not.toHaveProperty('institutionId');

      const asSender = await client.get('/messages').set(school.teacherHeaders);
      const asRecipient = await client.get('/messages').set(school.parentHeaders);
      const asStray = await client.get('/messages').set(school.strayHeaders);
      const asAdmin = await client.get('/messages').set(school.adminHeaders);

      expect(asSender.body.data).toHaveLength(1);
      expect(asRecipient.body.data).toHaveLength(1);
      expect(asRecipient.body.data[0]).not.toHaveProperty('institutionId');
      expect(asStray.body.data).toHaveLength(0);
      expect(asAdmin.body.data).toHaveLength(0);

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.eventName, 'message.received'));
      expect(rows).toHaveLength(1);
    });

    it('refuses an unknown recipient', async () => {
      const school = await createSchool();

      const response = await client
        .post('/messages')
        .set(school.teacherHeaders)
        .send({
          recipientUserId: '00000000-0000-4000-8000-000000000999',
          subject: 'Hi',
          body: 'Nobody home',
        });

      expect(response.status).toBe(404);
    });

    it('lets only the recipient mark a message as read', async () => {
      const school = await createSchool();
      const sent = await client
        .post('/messages')
        .set(school.teacherHeaders)
        .send({
          recipientUserId: school.parent.id,
          subject: 'Hello',
          body: 'About the exam',
        });
      const messageId = sent.body.data.id as string;

      const bySender = await client
        .patch(`/messages/${messageId}/read`)
        .set(school.teacherHeaders);
      const byStray = await client
        .patch(`/messages/${messageId}/read`)
        .set(school.strayHeaders);
      const stillUnread = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId));
      const byRecipient = await client
        .patch(`/messages/${messageId}/read`)
        .set(school.parentHeaders);

      expect(bySender.status).toBe(404);
      expect(byStray.status).toBe(404);
      expect(stillUnread[0].readAt).toBeNull();
      expect(byRecipient.status).toBe(200);
      expect(byRecipient.body.data.readAt).not.toBeNull();
      expect(byRecipient.body.data).not.toHaveProperty('institutionId');
    });
  });
});
