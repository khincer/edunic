import { sql } from 'drizzle-orm';
import { db } from '@edunic/source/db';
import { createTestApp } from '../helpers/app.js';
import { resetTestDatabase } from '../helpers/db.js';
import {
  createClassroomFixture,
  createInstitutionFixture,
  createTeacherClassroomAssignmentFixture,
  createUserFixture,
} from '../helpers/fixtures.js';

// E2E flow 4 (task 3.3, P3-R5): the teacher journey. A teacher logs in
// through the real /auth/login endpoint, sees only assigned classrooms in
// the list, and is refused the admin-only student write. The admin journey
// over the same data triangulates the scoping.
async function countStudents() {
  const result = await db.execute(
    sql.raw('SELECT COUNT(*)::int AS count FROM students')
  );
  return (result.rows[0] as { count: number }).count;
}

describe('E2E flow: teachers', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    await createInstitutionFixture('Teachers Flow Institution');
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(user: Awaited<ReturnType<typeof createUserFixture>>) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: user.password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.role).toBe(user.role);

    return {
      authorization: `Bearer ${response.json().data.token}`,
    };
  }

  it('scopes the teacher to assigned classrooms and blocks the admin write', async () => {
    const assignedClassroom = await createClassroomFixture({
      gradeLevel: 6,
      section: 'A',
    });
    await createClassroomFixture({ gradeLevel: 7, section: 'B' });

    const teacher = await createUserFixture({
      role: 'teacher',
      email: 'e2e-teacher@teachers-flow.test',
      password: 'teacher1234',
    });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: assignedClassroom.id,
    });

    const teacherHeaders = await loginAs(teacher);

    const list = await app.inject({
      method: 'GET',
      url: '/classrooms',
      headers: teacherHeaders,
    });

    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0].id).toBe(assignedClassroom.id);

    const write = await app.inject({
      method: 'POST',
      url: '/students',
      headers: teacherHeaders,
      payload: { firstName: 'Blocked', firstLastName: 'TeacherWrite', secondLastName: 'Test' },
    });

    expect(write.statusCode).toBe(403);
    expect(write.json().code).toBe('FORBIDDEN');
    expect(await countStudents()).toBe(0);
  });

  it('shows the admin every classroom in the institution', async () => {
    const assignedClassroom = await createClassroomFixture({
      gradeLevel: 6,
      section: 'A',
    });
    const otherClassroom = await createClassroomFixture({
      gradeLevel: 7,
      section: 'B',
    });

    const teacher = await createUserFixture({ role: 'teacher' });
    await createTeacherClassroomAssignmentFixture({
      teacherUserId: teacher.id,
      classroomId: assignedClassroom.id,
    });

    const admin = await createUserFixture({
      role: 'director',
      email: 'e2e-admin@teachers-flow.test',
      password: 'admin1234',
    });
    const adminHeaders = await loginAs(admin);

    const list = await app.inject({
      method: 'GET',
      url: '/classrooms',
      headers: adminHeaders,
    });

    expect(list.statusCode).toBe(200);
    expect(
      list.json().data.map((row: { id: string }) => row.id).sort()
    ).toEqual([assignedClassroom.id, otherClassroom.id].sort());
  });
});
