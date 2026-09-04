export { ExtensionsService, ExtensionsServiceError } from './application/extensions.service.js';
export { ExtensionsRepository } from './infrastructure/extensions.repository.js';
export type { ExtensionRecord, InstitutionExtensionRecord, CreateExtensionInput, UpdateExtensionInput } from './infrastructure/extensions.repository.js';
export { extensionParamsSchema, institutionExtensionParamsSchema, institutionExtensionsParamsSchema, listExtensionsQuerySchema, createExtensionBodySchema, updateExtensionBodySchema, upsertInstitutionExtensionBodySchema } from './schemas/extension.schemas.js';
export type { ListExtensionsQuery, CreateExtensionBody, UpdateExtensionBody, UpsertInstitutionExtensionBody } from './schemas/extension.schemas.js';
