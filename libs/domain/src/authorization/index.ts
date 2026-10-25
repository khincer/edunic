export {
  AccessService,
  type ReadActor,
  type ReadableStudents,
} from './application/access.service.js';
export { AccessRepository } from './infrastructure/access.repository.js';
export {
  ADMIN_ROLES,
  adminAnd,
  isAdminRole,
  toAudienceRole,
  type AdminRole,
  type AudienceRole,
} from './roles.js';
