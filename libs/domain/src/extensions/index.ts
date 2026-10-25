export { ExtensionsService, ExtensionsServiceError } from './application/extensions.service.js';
export { ExtensionsRepository } from './infrastructure/extensions.repository.js';
export type { ExtensionRecord, CreateExtensionInput, UpdateExtensionInput } from './infrastructure/extensions.repository.js';
export { extensionParamsSchema, listExtensionsQuerySchema, createExtensionBodySchema, updateExtensionBodySchema, setExtensionConfigBodySchema } from './schemas/extension.schemas.js';
export type { ListExtensionsQuery, CreateExtensionBody, UpdateExtensionBody, SetExtensionConfigBody } from './schemas/extension.schemas.js';
