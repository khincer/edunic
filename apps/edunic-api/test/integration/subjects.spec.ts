import { db } from '@edunic/source/db';
import { guardianUserLinks, studentGuardians } from '@edunic/source/db/schema';
import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createClassroomFixture,
  createEnrollmentFixture,
  createAcademicPeriodFixture,
  createGuardianFixture,
  createInstitutionFixture,
  createStudentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('subjects routes', () => {
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
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const classroom = await createClassroomFixture({
      institutionId: institution.id,
    });

    return {
      institution,
      classroom,
      teacher,
      adminHeaders: await createAuthHeaders({
        userId: admin.id,
        institutionId: institution.id,
      }),
      teacherHeaders: await createAuthHeaders({
        userId: teacher.id,
        institutionId: institution.id,
      }),
    };
  }

  it('creates a materia with its temas', async () => {
    const { adminHeaders } = await createSchool();

    const subject = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: '  Matemáticas ', code: 'MAT' });

    expect(subject.status).toBe(201);
    expect(subject.body.data.name).toBe('Matemáticas');
    expect(subject.body.data.code).toBe('MAT');
    expect(subject.body.data.active).toBe(true);

    const topic = await client
      .post(`/subjects/${subject.body.data.id}/topics`)
      .set(adminHeaders)
      .send({ name: 'Sumas' });

    expect(topic.status).toBe(201);
    expect(topic.body.data.name).toBe('Sumas');

    const topics = await client
      .get(`/subjects/${subject.body.data.id}/topics`)
      .set(adminHeaders);

    expect(topics.status).toBe(200);
    expect(topics.body.data).toHaveLength(1);
  });

  it('keeps the materia catalog away from a teacher creating one', async () => {
    const { teacherHeaders } = await createSchool();

    const response = await client
      .post('/subjects')
      .set(teacherHeaders)
      .send({ name: 'Historia' });

    expect(response.status).toBe(403);
  });

  it('renames and deactivates a materia', async () => {
    const { adminHeaders } = await createSchool();

    const created = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: 'Ciencias' });

    const response = await client
      .patch(`/subjects/${created.body.data.id}`)
      .set(adminHeaders)
      .send({ name: 'Ciencias Naturales', active: false });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Ciencias Naturales');
    expect(response.body.data.active).toBe(false);
  });

  it('assigns a materia to a grade level and to a teacher', async () => {
    const { adminHeaders, classroom, teacher } = await createSchool();

    const subject = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: 'Matemáticas' });

    const classroomAssignment = await client
      .post(`/subjects/classroom/${classroom.id}`)
      .set(adminHeaders)
      .send({ subjectIds: [subject.body.data.id] });

    expect(classroomAssignment.status).toBe(200);
    expect(classroomAssignment.body.data).toHaveLength(1);

    const teacherAssignment = await client
      .post(`/subjects/teacher/${teacher.id}`)
      .set(adminHeaders)
      .send({ subjectIds: [subject.body.data.id] });

    expect(teacherAssignment.status).toBe(200);
    expect(teacherAssignment.body.data).toHaveLength(1);
  });

  it('refuses an assignment of a materia that does not exist', async () => {
    const { adminHeaders, classroom } = await createSchool();

    const response = await client
      .post(`/subjects/classroom/${classroom.id}`)
      .set(adminHeaders)
      .send({ subjectIds: ['00000000-0000-4000-8000-000000000000'] });

    expect(response.status).toBe(404);
  });

  it('removes a materia from a grade level', async () => {
    const { adminHeaders, classroom } = await createSchool();

    const subject = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: 'Matemáticas' });

    await client
      .post(`/subjects/classroom/${classroom.id}`)
      .set(adminHeaders)
      .send({ subjectIds: [subject.body.data.id] });

    const response = await client
      .delete(
        `/subjects/classroom/${classroom.id}/${subject.body.data.id}`
      )
      .set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data.deleted).toBe(true);

    const remaining = await client
      .get(`/subjects/classroom/${classroom.id}`)
      .set(adminHeaders);
    expect(remaining.body.data).toHaveLength(0);
  });

  it('shows a teacher only the materias assigned to them', async () => {
    const { adminHeaders, teacherHeaders, teacher } = await createSchool();

    const mine = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: 'Matemáticas' });
    const other = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: 'Historia' });

    await client
      .post(`/subjects/teacher/${teacher.id}`)
      .set(adminHeaders)
      .send({ subjectIds: [mine.body.data.id] });

    const list = await client.get('/subjects').set(teacherHeaders);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].name).toBe('Matemáticas');

    // The admin sees the whole catalog.
    const all = await client.get('/subjects').set(adminHeaders);
    expect(all.body.data).toHaveLength(2);
    expect(other.body.data.name).toBe('Historia');
  });

  it('shows a parent the materias their children study', async () => {
    const { adminHeaders, classroom, institution } = await createSchool();

    const subject = await client
      .post('/subjects')
      .set(adminHeaders)
      .send({ name: 'Matem?ticas' });
    await client
      .post(`/subjects/classroom/${classroom.id}`)
      .set(adminHeaders)
      .send({ subjectIds: [subject.body.data.id] });

    const period = await createAcademicPeriodFixture({
      institutionId: institution.id,
    });
    const student = await createStudentFixture({
      institutionId: institution.id,
    });
    const guardian = await createGuardianFixture({
      institutionId: institution.id,
    });
    await db.insert(studentGuardians).values({
      studentId: student.id,
      guardianId: guardian.id,
    });

    await createEnrollmentFixture({
      institutionId: institution.id,
      studentId: student.id,
      academicPeriodId: period.id,
      classroomId: classroom.id,
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

    const list = await client.get('/subjects').set(parentHeaders);

    expect(list.status).toBe(200);
    expect(list.body.data.map((row: { name: string }) => row.name)).toEqual([
      'Matem?ticas',
    ]);
  });
});
