import { AppError } from '@edunic/source/domain/shared';
import { AccessRepository } from '../infrastructure/access.repository.js';
import { isAdminRole } from '../roles.js';

export type ReadActor = { role: string; userId: string };

// `all: true` is the administration; otherwise the ids a list may contain
// (possibly empty: such an actor sees nothing).
export type ReadableStudents =
  | { all: true }
  | { all: false; studentIds: string[] };

/**
 * The single place that answers "does this actor own this record?".
 *
 * A teacher owns the classrooms they are assigned to; the academic records
 * of a classroom belong to the teachers of that classroom. The check lives in
 * the service layer, not only in the route guards, because a route guard
 * cannot express "own classroom".
 */
export class AccessService {
  constructor(private readonly accessRepository: AccessRepository) {}

  async assertTeacherOwnsClassroom(
    teacherUserId: string,
    classroomId: string
  ): Promise<void> {
    const assigned =
      await this.accessRepository.isTeacherAssignedToClassroom(
        teacherUserId,
        classroomId
      );

    if (!assigned) {
      throw new AppError(
        'Teacher is not assigned to this classroom',
        403
      );
    }
  }

  // The students a parent account may read.
  async listParentStudentIds(parentUserId: string): Promise<string[]> {
    return this.accessRepository.listParentStudentIds(parentUserId);
  }

  async assertParentOwnsStudent(
    parentUserId: string,
    studentId: string
  ): Promise<void> {
    const owns = await this.accessRepository.isParentOwnsStudent(
      parentUserId,
      studentId
    );

    if (!owns) {
      throw new AppError(
        'This student is not linked to your account',
        403
      );
    }
  }

  async assertTeacherTeachesStudent(
    teacherUserId: string,
    studentId: string
  ): Promise<void> {
    const teaches = await this.accessRepository.isTeacherTeachesStudent(
      teacherUserId,
      studentId
    );

    if (!teaches) {
      throw new AppError(
        'The student is not in a classroom of this teacher',
        403
      );
    }
  }

  // The one rule for reading a student's record: the administration reads any
  // student, a teacher the students of their classrooms, a parent their own
  // children. Run it BEFORE the lookup so a refusal does not reveal whether
  // the student exists.
  async assertCanReadStudent(
    actor: ReadActor,
    studentId: string
  ): Promise<void> {
    if (isAdminRole(actor.role)) {
      return;
    }

    if (actor.role === 'teacher') {
      return this.assertTeacherTeachesStudent(actor.userId, studentId);
    }

    if (actor.role === 'parent') {
      return this.assertParentOwnsStudent(actor.userId, studentId);
    }

    throw new AppError('Forbidden', 403);
  }

  // A guardian's record follows the students they are a guardian of.
  async assertCanReadGuardian(
    actor: ReadActor,
    guardianId: string
  ): Promise<void> {
    if (isAdminRole(actor.role)) {
      return;
    }

    const allowed =
      actor.role === 'teacher'
        ? await this.accessRepository.isGuardianOfTeacherStudent(
            actor.userId,
            guardianId
          )
        : actor.role === 'parent'
          ? await this.accessRepository.isGuardianOfParentStudent(
              actor.userId,
              guardianId
            )
          : false;

    if (!allowed) {
      throw new AppError('Forbidden', 403);
    }
  }

  // An enrollment follows its student. A missing enrollment is refused to
  // non-admin actors so the answer does not reveal whether it exists.
  async assertCanReadEnrollment(
    actor: ReadActor,
    enrollmentId: string
  ): Promise<void> {
    if (isAdminRole(actor.role)) {
      return;
    }

    const studentId =
      await this.accessRepository.findEnrollmentStudentId(enrollmentId);

    if (!studentId) {
      throw new AppError('Forbidden', 403);
    }

    await this.assertCanReadStudent(actor, studentId);
  }

  // Which students a list may contain for this actor: everything for the
  // administration, otherwise the explicit set the actor may read.
  async resolveReadableStudents(actor: ReadActor): Promise<ReadableStudents> {
    if (isAdminRole(actor.role)) {
      return { all: true };
    }

    if (actor.role === 'teacher') {
      return {
        all: false,
        studentIds: await this.accessRepository.listTeacherStudentIds(
          actor.userId
        ),
      };
    }

    if (actor.role === 'parent') {
      return {
        all: false,
        studentIds: await this.accessRepository.listParentStudentIds(
          actor.userId
        ),
      };
    }

    throw new AppError('Forbidden', 403);
  }

  async assertTeacherOwnsSubject(
    teacherUserId: string,
    subjectId: string
  ): Promise<void> {
    const owns =
      await this.accessRepository.isTeacherOwnsSubject(
        teacherUserId,
        subjectId
      );

    if (!owns) {
      throw new AppError(
        'Teacher does not teach this subject',
        403
      );
    }
  }

  async assertTeacherOwnsEnrollment(
    teacherUserId: string,
    enrollmentId: string
  ): Promise<void> {
    const classroomId =
      await this.accessRepository.findEnrollmentClassroomId(enrollmentId);

    if (!classroomId) {
      throw new AppError(
        'The student is not enrolled in a classroom of this teacher',
        403
      );
    }

    await this.assertTeacherOwnsClassroom(teacherUserId, classroomId);
  }
}
