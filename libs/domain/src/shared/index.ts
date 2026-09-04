export { uuidSchema } from './uuid.schema.js';

export {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
} from './app-error.js';

export { parseWithSchema } from './parse-with-schema.js';

export {
  institutionHeaderSchema,
  getInstitutionId,
} from './institution.js';

export {
  computeAverage,
  buildSubjectAverages,
  toRoundedAverage,
  type GradeRow,
  type AverageBucket,
} from './grade-average.js';

export { PROMOTION_THRESHOLD } from './constants.js';
