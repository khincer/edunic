import { AppError } from '@edunic/source/domain/shared';
import { AccessRepository } from '../infrastructure/access.repository.js';

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
