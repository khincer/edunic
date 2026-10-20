import type {
  CreateInstitutionBody,
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

  async getInstitution(institutionId: string) {
    const institution = await this.institutionsRepository.findById(institutionId);

    if (!institution) {
      throw new InstitutionsServiceError('Institution not found', 404);
    }

    return {
      data: this.toInstitutionResponse(institution),
    };
  }

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
      institutionId: institution.id,
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
      senderName: input.senderName,
      replyToEmail: input.replyToEmail,
    });

    if (!updatedInstitution) {
      throw new InstitutionsServiceError('Institution not found', 404);
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
