export {
  SubjectsService,
  SubjectsServiceError,
} from './application/subjects.service.js';
export { SubjectsRepository } from './infrastructure/subjects.repository.js';
export type {
  SubjectRecord,
  TopicRecord,
} from './infrastructure/subjects.repository.js';
export {
  createSubjectBodySchema,
  updateSubjectBodySchema,
  subjectParamsSchema,
  topicParamsSchema,
  createTopicBodySchema,
  updateTopicBodySchema,
  classroomSubjectsParamsSchema,
  classroomSubjectParamsSchema,
  teacherSubjectsParamsSchema,
  teacherSubjectParamsSchema,
  assignSubjectsBodySchema,
} from './schemas/subjects.schemas.js';
export type {
  CreateSubjectBody,
  UpdateSubjectBody,
  AssignSubjectsBody,
} from './schemas/subjects.schemas.js';
