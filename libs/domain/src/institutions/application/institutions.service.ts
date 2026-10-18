import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateInstitutionBody,
  ListInstitutionsQuery,
  UpdateInstitutionBody,
} from '../schemas/institution.schemas.js';
import {
  InstitutionsRepository,
  type InstitutionRecord,
} from '../infrastructure/institutions.repository.js';

export class InstitutionsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'InstitutionsServiceError';
  }
}

export class InstitutionsService {
  constructor(
    private readonly institutionsRepository: InstitutionsRepository
  ) {}

  async listInstitutions(
    input: ListInstitutionsQuery & {
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.institutionsRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
    });

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (institution) => institution.name,
        id: (institution) => institution.id,
      },
      result.total
    );

    return {
      data: page.data.map((institution) =>
        this.toInstitutionResponse(institution)
      ),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getInstitution(institutionId: string) {
    const institution = await this.institutionsRepository.findById(institutionId);

    if (!institution) {
      throw new InstitutionsServiceError('Institution not found', 404);
    }

    return {
      data: this.toInstitutionResponse(institution),
    };
  }

  async createInstitution(input: CreateInstitutionBody) {
    const institution = await this.institutionsRepository.create({
      name: input.name.trim(),
    });

    return {
      data: this.toInstitutionResponse(institution),
    };
  }

  async updateInstitution(
    input: UpdateInstitutionBody & { institutionId: string }
  ) {
    const existingInstitution = await this.institutionsRepository.findById(
      input.institutionId
    );

    if (!existingInstitution) {
      throw new InstitutionsServiceError('Institution not found', 404);
    }

    const updatedInstitution = await this.institutionsRepository.update({
      institutionId: input.institutionId,
      name: input.name?.trim(),
    });

    if (!updatedInstitution) {
      throw new InstitutionsServiceError('Institution not found', 404);
    }

    return {
      data: this.toInstitutionResponse(updatedInstitution),
    };
  }

  async deleteInstitution(institutionId: string) {
    const institution = await this.institutionsRepository.findById(institutionId);

    if (!institution) {
      throw new InstitutionsServiceError('Institution not found', 404);
    }

    const dependencies =
      await this.institutionsRepository.countDependencies(institutionId);

    if (
      dependencies.students > 0 ||
      dependencies.classrooms > 0 ||
      dependencies.enrollments > 0
    ) {
      throw new InstitutionsServiceError(
        'Institution cannot be deleted while dependent academic records exist',
        409
      );
    }

    await this.institutionsRepository.delete(institutionId);

    return {
      data: {
        id: institutionId,
        deleted: true,
      },
    };
  }

  private toInstitutionResponse(institution: InstitutionRecord) {
    return {
      id: institution.id,
      name: institution.name,
      createdAt: institution.createdAt,
    };
  }
}
