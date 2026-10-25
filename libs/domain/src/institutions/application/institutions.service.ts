import type { UpdateInstitutionBody } from '../schemas/institution.schemas.js';
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

  // The single-school model: the school is one record, not a list.
  async getSchoolProfile() {
    const institution = await this.institutionsRepository.findSingle();

    if (!institution) {
      throw new InstitutionsServiceError('School profile not found', 404);
    }

    return {
      data: this.toInstitutionResponse(institution),
    };
  }

  async updateSchoolProfile(input: UpdateInstitutionBody) {
    const institution = await this.institutionsRepository.findSingle();

    if (!institution) {
      throw new InstitutionsServiceError('School profile not found', 404);
    }

    const updatedInstitution = await this.institutionsRepository.update({
      id: institution.id,
      name: input.name?.trim(),
      senderName: input.senderName,
      replyToEmail: input.replyToEmail,
    });

    if (!updatedInstitution) {
      throw new InstitutionsServiceError('School profile not found', 404);
    }

    return {
      data: this.toInstitutionResponse(updatedInstitution),
    };
  }

  private toInstitutionResponse(institution: InstitutionRecord) {
    return {
      id: institution.id,
      name: institution.name,
      senderName: institution.senderName,
      replyToEmail: institution.replyToEmail,
      createdAt: institution.createdAt,
    };
  }
}
