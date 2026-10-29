export {
  NO_ACTIVE_PERIOD_MESSAGE,
  StudentsService,
  StudentsServiceError,
  ageOn,
  composeFullName,
} from './application/students.service.js';
export { StudentsRepository } from './infrastructure/students.repository.js';
export type {
  StudentRecord,
  StudentContextRecord,
  CreateStudentInput,
  UpdateStudentInput,
  ListStudentsInput,
} from './infrastructure/students.repository.js';
export {
  studentParamsSchema,
  listStudentsQuerySchema,
  createStudentBodySchema,
  updateStudentBodySchema,
  registerStudentBodySchema,
} from './schemas/student.schemas.js';
export type {
  ListStudentsQuery,
  CreateStudentBody,
  UpdateStudentBody,
  RegisterStudentBody,
} from './schemas/student.schemas.js';
