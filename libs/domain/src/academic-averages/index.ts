export { AcademicAveragesService, AcademicAveragesServiceError } from './application/academic-averages.service.js';
export { AcademicAveragesRepository } from './infrastructure/academic-averages.repository.js';
export type { StudentGradeRow } from './infrastructure/academic-averages.repository.js';
export { institutionHeaderSchema, studentAverageParamsSchema, studentAverageQuerySchema } from './schemas/academic-averages.schemas.js';
export type { StudentAverageQuery } from './schemas/academic-averages.schemas.js';
