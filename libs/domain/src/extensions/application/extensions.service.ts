import type {
  CreateExtensionBody,
  ListExtensionsQuery,
  UpdateExtensionBody,
  UpsertInstitutionExtensionBody,
} from '../schemas/extension.schemas.js';
import {
  ExtensionsRepository,
  type ExtensionRecord,
  type InstitutionExtensionRecord,
} from '../infrastructure/extensions.repository.js';

export class ExtensionsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ExtensionsServiceError';
  }
}

export class ExtensionsService {
  constructor(private readonly extensionsRepository: ExtensionsRepository) {}

  async listExtensions(input: ListExtensionsQuery) {
    const result = await this.extensionsRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
    });

    return {
      data: result.items.map((extension) => this.toExtensionResponse(extension)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async createExtension(input: CreateExtensionBody) {
    const existingExtension = await this.extensionsRepository.findByKey(input.key);

    if (existingExtension) {
      throw new ExtensionsServiceError('Extension already exists', 409);
    }

    const extension = await this.extensionsRepository.create({
      key: input.key,
      name: input.name.trim(),
      enabled: input.enabled,
    });

    return {
      data: this.toExtensionResponse(extension),
    };
  }

  async updateExtension(input: UpdateExtensionBody & { extensionKey: string }) {
    const existingExtension = await this.extensionsRepository.findByKey(
      input.extensionKey
    );

    if (!existingExtension) {
      throw new ExtensionsServiceError('Extension not found', 404);
    }

    const extension = await this.extensionsRepository.update({
      key: input.extensionKey,
      name: input.name === undefined ? undefined : input.name?.trim() ?? null,
      enabled: input.enabled,
    });

    if (!extension) {
      throw new ExtensionsServiceError('Extension not found', 404);
    }

    return {
      data: this.toExtensionResponse(extension),
    };
  }

  async listInstitutionExtensions(institutionId: string) {
    const extensions =
      await this.extensionsRepository.listInstitutionExtensions(institutionId);

    return {
      data: extensions.map((extension) =>
        this.toInstitutionExtensionResponse(extension)
      ),
    };
  }

  async upsertInstitutionExtension(
    input: UpsertInstitutionExtensionBody & {
      institutionId: string;
      extensionKey: string;
    }
  ) {
    const extension = await this.extensionsRepository.findByKey(
      input.extensionKey
    );

    if (!extension) {
      throw new ExtensionsServiceError('Extension not found', 404);
    }

    const institutionExtension =
      await this.extensionsRepository.upsertInstitutionExtension({
        institutionId: input.institutionId,
        extensionKey: input.extensionKey,
        config: input.config,
      });

    if (!institutionExtension) {
      throw new ExtensionsServiceError('Institution extension not found', 404);
    }

    return {
      data: this.toInstitutionExtensionResponse(institutionExtension),
    };
  }

  async deleteInstitutionExtension(institutionId: string, extensionKey: string) {
    const institutionExtension =
      await this.extensionsRepository.deleteInstitutionExtension(
        institutionId,
        extensionKey
      );

    if (!institutionExtension) {
      throw new ExtensionsServiceError('Institution extension not found', 404);
    }

    return {
      data: {
        institutionId,
        extensionKey,
        deleted: true,
      },
    };
  }

  private toExtensionResponse(extension: ExtensionRecord) {
    return {
      key: extension.key,
      name: extension.name,
      enabled: extension.enabled ?? false,
    };
  }

  private toInstitutionExtensionResponse(
    institutionExtension: InstitutionExtensionRecord
  ) {
    return {
      institutionId: institutionExtension.institutionId,
      extensionKey: institutionExtension.extensionKey,
      config: institutionExtension.config ?? {},
      extension: {
        key: institutionExtension.extensionKey,
        name: institutionExtension.extensionName,
        enabled: institutionExtension.extensionEnabled ?? false,
      },
    };
  }
}
