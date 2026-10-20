export {
  TeachersService,
  TeachersServiceError,
} from './application/teachers.service.js';
export { TeachersRepository } from './infrastructure/teachers.repository.js';
export type {
  TeacherRecord,
  TeacherClassroomRecord,
} from './infrastructure/teachers.repository.js';
export {
  createTeacherBodySchema,
  listTeachersQuerySchema,
  teacherParamsSchema,
  teacherClassroomParamsSchema,
  updateTeacherRoleBodySchema,
  assignClassroomsBodySchema,
} from './schemas/teachers.schemas.js';
export type {
  ListTeachersQuery,
  CreateTeacherBody,
  UpdateTeacherRoleBody,
  AssignClassroomsBody,
} from './schemas/teachers.schemas.js';
