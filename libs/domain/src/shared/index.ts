export { uuidSchema } from './uuid.schema.js';

export {
  AppError,
  ValidationError,
} from './app-error.js';

export { parseWithSchema } from './parse-with-schema.js';

export {
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

export { buildStudentIdCondition } from './student-scope.js';

export {
  ErrorCode,
  createEnvelope,
  createErrorEnvelope,
  type ResponseEnvelope,
  type ErrorEnvelope,
  type EnvelopeLinks,
} from './http/response-envelope.js';

export {
  encodeCursor,
  decodeCursor,
  toCursorSortKey,
  applyCursorPagination,
  buildCursorPage,
  type PaginationParams,
  type CursorOrderSpec,
  type CursorPage,
  type CursorPageMeta,
  type CursorPaginationPlan,
  type CursorSortKey,
} from './http/pagination.js';

export {
  buildIdempotencyKey,
  lookupIdempotency,
  storeIdempotentResponse,
  releaseIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  IDEMPOTENCY_KEY_HEADER,
  type IdempotencyStore,
  type IdempotencyScope,
  type IdempotencyLookup,
} from './http/idempotency.js';

export {
  parseFilterSort,
  buildFilterConditions,
  buildSortSql,
  type FilterOperator,
  type FilterSpec,
  type FilterSortOptions,
  type FilterValue,
  type SortSpec,
  type ParsedFilterSort,
} from './http/filter-sort.js';

export {
  insertOutboxEvent,
  markOutboxPublished,
  fetchUnpublishedOutboxEvents,
  type DbExecutor,
  type OutboxEventRow,
} from './outbox.js';
