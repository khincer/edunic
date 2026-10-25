import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateExtensionBody,
  ListExtensionsQuery,
  UpdateExtensionBody,
  SetExtensionConfigBody,
} from '../schemas/extension.schemas.js';
import {
  ExtensionsRepository,
  type ExtensionRecord,
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

  async listExtensions(
    input: ListExtensionsQuery & {
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.extensionsRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        // `key` is the whole stable order: it is the only sort column and the
        // unique tiebreaker, so the cursor carries no separate sort-key value.
        sortKey: () => [],
        id: (extension) => extension.key,
      },
      result.total
    );

    return {
      data: page.data.map((extension) => this.toExtensionResponse(extension)),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
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

  async setConfig(input: SetExtensionConfigBody & { extensionKey: string }) {
    return this.writeConfig(input.extensionKey, input.config);
  }

  async clearConfig(extensionKey: string) {
    return this.writeConfig(extensionKey, null);
  }

  private async writeConfig(
    extensionKey: string,
    config: Record<string, unknown> | null
  ) {
    const extension = await this.extensionsRepository.setConfig(
      extensionKey,
      config
    );

    if (!extension) {
      throw new ExtensionsServiceError('Extension not found', 404);
    }

    return {
      data: this.toExtensionResponse(extension),
    };
  }

  private toExtensionResponse(extension: ExtensionRecord) {
    return {
      key: extension.key,
      name: extension.name,
      enabled: extension.enabled ?? false,
      config: extension.config ?? null,
    };
  }
}
