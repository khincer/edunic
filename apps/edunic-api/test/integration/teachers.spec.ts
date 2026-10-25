import { createTestApp, createHttpClient } from '../helpers/app.js';
import { createAuthHeaders } from '../helpers/auth.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createClassroomFixture,
  createInstitutionFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

describe('teachers routes', () => {
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

  async function createDirector() {
    const institution = await createInstitutionFixture();
    const director = await createUserFixture({
      institutionId: institution.id,
      role: 'director',
    });

    return {
      institution,
      director,
      headers: await createAuthHeaders({
        userId: director.id,
        institutionId: institution.id,
      }),
    };
  }

  it('lists the teachers of the school', async () => {
    const { institution, headers } = await createDirector();
    await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
      email: 'teacher.one@school.edu',
    });
    await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
      email: 'teacher.two@school.edu',
    });
    // A parent is not a teacher.
    await createUserFixture({
      institutionId: institution.id,
      role: 'parent',
      email: 'parent@school.edu',
    });

    const response = await client.get('/teachers').set(headers);

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(2);
    expect(
      response.body.data.map((teacher: { email: string }) => teacher.email)
    ).toEqual(['teacher.one@school.edu', 'teacher.two@school.edu']);
  });

  it('keeps the teacher list away from a teacher', async () => {
    const { institution } = await createDirector();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const headers = await createAuthHeaders({
      userId: teacher.id,
      institutionId: institution.id,
    });

    const response = await client.get('/teachers').set(headers);

    expect(response.status).toBe(403);
  });

  it('creates a teacher account', async () => {
    const { institution, headers } = await createDirector();
    const classroom = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 5,
      section: 'A',
    });

    const response = await client
      .post('/teachers')
      .set(headers)
      .send({
        email: '  New.Teacher@school.edu ',
        password: 'teacher1234',
        classroomIds: [classroom.id],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('new.teacher@school.edu');
    expect(response.body.data.role).toBe('teacher');

    // The new account can sign in and reads as a teacher.
    const login = await client.post('/auth/login').send({
      email: 'new.teacher@school.edu',
      password: 'teacher1234',
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('teacher');

    // ... and it was assigned to the classroom it was created with.
    const classrooms = await client
      .get(`/teachers/${response.body.data.id}/classrooms`)
      .set(headers);
    expect(classrooms.status).toBe(200);
    expect(classrooms.body.data).toHaveLength(1);
    expect(classrooms.body.data[0].id).toBe(classroom.id);
  });

  it('refuses a duplicate teacher account', async () => {
    const { institution, headers } = await createDirector();
    await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
      email: 'taken@school.edu',
    });

    const response = await client
      .post('/teachers')
      .set(headers)
      .send({ email: 'taken@school.edu', password: 'teacher1234' });

    expect(response.status).toBe(409);
  });

  it('assigns a teacher to one or more classrooms', async () => {
    const { institution, headers } = await createDirector();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const first = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 5,
      section: 'A',
    });
    const second = await createClassroomFixture({
      institutionId: institution.id,
      gradeLevel: 6,
      section: 'B',
    });

    const response = await client
      .post(`/teachers/${teacher.id}/classrooms`)
      .set(headers)
      .send({ classroomIds: [first.id, second.id] });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);

    // Assigning the same classroom twice does not duplicate the row.
    const again = await client
      .post(`/teachers/${teacher.id}/classrooms`)
      .set(headers)
      .send({ classroomIds: [first.id] });

    expect(again.status).toBe(200);
    expect(again.body.data).toHaveLength(2);
  });

  it('refuses an assignment to a classroom that does not exist', async () => {
    const { institution, headers } = await createDirector();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .post(`/teachers/${teacher.id}/classrooms`)
      .set(headers)
      .send({ classroomIds: ['00000000-0000-4000-8000-000000000000'] });

    expect(response.status).toBe(404);
  });

  it('removes a classroom from a teacher', async () => {
    const { institution, headers } = await createDirector();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const classroom = await createClassroomFixture({
      institutionId: institution.id,
    });

    await client
      .post(`/teachers/${teacher.id}/classrooms`)
      .set(headers)
      .send({ classroomIds: [classroom.id] });

    const response = await client
      .delete(`/teachers/${teacher.id}/classrooms/${classroom.id}`)
      .set(headers);

    expect(response.status).toBe(200);
    expect(response.body.data.deleted).toBe(true);

    const classrooms = await client
      .get(`/teachers/${teacher.id}/classrooms`)
      .set(headers);
    expect(classrooms.body.data).toHaveLength(0);
  });

  it('lets a teacher read their own record but not another one', async () => {
    const { institution } = await createDirector();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const other = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });
    const headers = await createAuthHeaders({
      userId: teacher.id,
      institutionId: institution.id,
    });

    const own = await client.get(`/teachers/${teacher.id}`).set(headers);
    expect(own.status).toBe(200);

    const foreign = await client.get(`/teachers/${other.id}`).set(headers);
    expect(foreign.status).toBe(403);
  });

  it('changes the role of a teacher', async () => {
    const { institution, headers } = await createDirector();
    const teacher = await createUserFixture({
      institutionId: institution.id,
      role: 'teacher',
    });

    const response = await client
      .patch(`/teachers/${teacher.id}/role`)
      .set(headers)
      .send({ role: 'vice_director' });

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('vice_director');
  });
});
