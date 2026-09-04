export { ClassroomsService, ClassroomsServiceError } from './application/classrooms.service.js';
export { ClassroomsRepository } from './infrastructure/classrooms.repository.js';
export type { ClassroomRecord, CreateClassroomInput, UpdateClassroomInput, ListClassroomsInput } from './infrastructure/classrooms.repository.js';
export { classroomParamsSchema, institutionHeaderSchema, listClassroomsQuerySchema, createClassroomBodySchema, updateClassroomBodySchema } from './schemas/classroom.schemas.js';
export type { ListClassroomsQuery, CreateClassroomBody, UpdateClassroomBody } from './schemas/classroom.schemas.js';
