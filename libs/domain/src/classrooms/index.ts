export {
  ClassroomsService,
  ClassroomsServiceError,
  DEFAULT_ACTIVITY_WINDOW_DAYS,
} from './application/classrooms.service.js';
export { ClassroomActivityRepository } from './infrastructure/classroom-activity.repository.js';
export type {
  ClassroomActivityTotalsRow,
  ClassroomActivityItemRow,
} from './infrastructure/classroom-activity.repository.js';
export { ClassroomsRepository } from './infrastructure/classrooms.repository.js';
export type { ClassroomRecord, CreateClassroomInput, UpdateClassroomInput, ListClassroomsInput } from './infrastructure/classrooms.repository.js';
export { classroomParamsSchema, classroomActivityQuerySchema, listClassroomsQuerySchema, createClassroomBodySchema, updateClassroomBodySchema } from './schemas/classroom.schemas.js';
export type { ClassroomActivityQuery, ListClassroomsQuery, CreateClassroomBody, UpdateClassroomBody } from './schemas/classroom.schemas.js';
