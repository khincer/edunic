import { AccessService } from '@edunic/source/domain/authorization';

// The single "can this actor read this student" rule. The repository is a
// stub: these tests pin the decision logic per role, not the SQL.
describe('AccessService read scoping', () => {
  function createService(overrides: Record<string, jest.Mock> = {}) {
    const repository = {
      isTeacherTeachesStudent: jest.fn().mockResolvedValue(false),
      isParentOwnsStudent: jest.fn().mockResolvedValue(false),
      isGuardianOfTeacherStudent: jest.fn().mockResolvedValue(false),
      isGuardianOfParentStudent: jest.fn().mockResolvedValue(false),
      findEnrollmentStudentId: jest.fn().mockResolvedValue(null),
      listTeacherStudentIds: jest.fn().mockResolvedValue([]),
      listParentStudentIds: jest.fn().mockResolvedValue([]),
      ...overrides,
    };

    return { repository, service: new AccessService(repository as never) };
  }

  const director = { role: 'director', userId: 'u-director' };
  const teacher = { role: 'teacher', userId: 'u-teacher' };
  const parent = { role: 'parent', userId: 'u-parent' };

  describe('assertCanReadStudent', () => {
    it.each(['director', 'vice_director', 'subdirector'])(
      'lets the %s read any student without a lookup',
      async (role) => {
        const { service, repository } = createService();

        await expect(
          service.assertCanReadStudent({ role, userId: 'u' }, 's-1')
        ).resolves.toBeUndefined();
        expect(repository.isTeacherTeachesStudent).not.toHaveBeenCalled();
        expect(repository.isParentOwnsStudent).not.toHaveBeenCalled();
      }
    );

    it('lets a teacher read a student they teach and refuses another', async () => {
      const { service, repository } = createService({
        isTeacherTeachesStudent: jest
          .fn()
          .mockImplementation(async (_t: string, studentId: string) => studentId === 's-mine'),
      });

      await expect(
        service.assertCanReadStudent(teacher, 's-mine')
      ).resolves.toBeUndefined();
      await expect(
        service.assertCanReadStudent(teacher, 's-other')
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(repository.isTeacherTeachesStudent).toHaveBeenCalledWith(
        'u-teacher',
        's-other'
      );
    });

    it('lets a parent read their own child and refuses another', async () => {
      const { service } = createService({
        isParentOwnsStudent: jest
          .fn()
          .mockImplementation(async (_p: string, studentId: string) => studentId === 's-mine'),
      });

      await expect(
        service.assertCanReadStudent(parent, 's-mine')
      ).resolves.toBeUndefined();
      await expect(
        service.assertCanReadStudent(parent, 's-other')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('refuses any other role', async () => {
      const { service } = createService();

      await expect(
        service.assertCanReadStudent({ role: 'student', userId: 'u' }, 's-1')
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('assertCanReadGuardian', () => {
    it('lets the administration read any guardian', async () => {
      const { service } = createService();

      await expect(
        service.assertCanReadGuardian(director, 'g-1')
      ).resolves.toBeUndefined();
    });

    it('lets a teacher read only a guardian of a student they teach', async () => {
      const { service, repository } = createService({
        isGuardianOfTeacherStudent: jest
          .fn()
          .mockImplementation(async (_t: string, guardianId: string) => guardianId === 'g-mine'),
      });

      await expect(
        service.assertCanReadGuardian(teacher, 'g-mine')
      ).resolves.toBeUndefined();
      await expect(
        service.assertCanReadGuardian(teacher, 'g-other')
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(repository.isGuardianOfTeacherStudent).toHaveBeenCalledWith(
        'u-teacher',
        'g-other'
      );
    });

    it('lets a parent read only a guardian of their own children', async () => {
      const { service, repository } = createService({
        isGuardianOfParentStudent: jest
          .fn()
          .mockImplementation(async (_p: string, guardianId: string) => guardianId === 'g-mine'),
      });

      await expect(
        service.assertCanReadGuardian(parent, 'g-mine')
      ).resolves.toBeUndefined();
      await expect(
        service.assertCanReadGuardian(parent, 'g-other')
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(repository.isGuardianOfParentStudent).toHaveBeenCalledWith(
        'u-parent',
        'g-other'
      );
    });

    it('refuses any other role', async () => {
      const { service } = createService();

      await expect(
        service.assertCanReadGuardian({ role: 'student', userId: 'u' }, 'g-1')
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('assertCanReadEnrollment', () => {
    it('lets the administration read any enrollment, even a missing one', async () => {
      const { service, repository } = createService();

      await expect(
        service.assertCanReadEnrollment(director, 'e-1')
      ).resolves.toBeUndefined();
      expect(repository.findEnrollmentStudentId).not.toHaveBeenCalled();
    });

    it('applies the student rule to the student of the enrollment', async () => {
      const { service, repository } = createService({
        findEnrollmentStudentId: jest.fn().mockResolvedValue('s-mine'),
        isParentOwnsStudent: jest
          .fn()
          .mockImplementation(async (_p: string, studentId: string) => studentId === 's-mine'),
        isTeacherTeachesStudent: jest.fn().mockResolvedValue(false),
      });

      await expect(
        service.assertCanReadEnrollment(parent, 'e-1')
      ).resolves.toBeUndefined();
      await expect(
        service.assertCanReadEnrollment(teacher, 'e-1')
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(repository.findEnrollmentStudentId).toHaveBeenCalledWith('e-1');
    });

    it('refuses a non-admin on an enrollment that does not exist', async () => {
      const { service } = createService({
        findEnrollmentStudentId: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.assertCanReadEnrollment(parent, 'e-missing')
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        service.assertCanReadEnrollment(teacher, 'e-missing')
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('refuses a non-admin without resolving anything when the record has no enrollment', async () => {
      const { service, repository } = createService();

      await expect(
        service.assertCanReadEnrollment(parent, null)
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        service.assertCanReadEnrollment(director, null)
      ).resolves.toBeUndefined();
      expect(repository.findEnrollmentStudentId).not.toHaveBeenCalled();
    });
  });

  describe('resolveReadableStudents', () => {
    it('reports every student for the administration', async () => {
      const { service } = createService();

      await expect(service.resolveReadableStudents(director)).resolves.toEqual({
        all: true,
      });
    });

    it('reports the students of the classrooms of a teacher', async () => {
      const { service, repository } = createService({
        listTeacherStudentIds: jest.fn().mockResolvedValue(['s-1', 's-2']),
      });

      await expect(service.resolveReadableStudents(teacher)).resolves.toEqual({
        all: false,
        studentIds: ['s-1', 's-2'],
      });
      expect(repository.listTeacherStudentIds).toHaveBeenCalledWith('u-teacher');
    });

    it('reports the own children of a parent, empty when none are linked', async () => {
      const { service } = createService({
        listParentStudentIds: jest
          .fn()
          .mockImplementation(async (userId: string) =>
            userId === 'u-parent' ? ['s-9'] : []
          ),
      });

      await expect(service.resolveReadableStudents(parent)).resolves.toEqual({
        all: false,
        studentIds: ['s-9'],
      });
      await expect(
        service.resolveReadableStudents({ role: 'parent', userId: 'u-stray' })
      ).resolves.toEqual({ all: false, studentIds: [] });
    });

    it('refuses any other role', async () => {
      const { service } = createService();

      await expect(
        service.resolveReadableStudents({ role: 'student', userId: 'u' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
