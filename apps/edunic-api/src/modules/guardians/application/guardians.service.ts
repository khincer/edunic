import type {
  CreateGuardianBody,
  ListGuardiansQuery,
  UpdateGuardianBody,
} from '../schemas/guardian.schemas.js';
import {
  GuardiansRepository,
  type GuardianRecord,
} from '../infrastructure/guardians.repository.js';

export class GuardiansServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'GuardiansServiceError';
  }
}

export class GuardiansService {
  constructor(private readonly guardiansRepository: GuardiansRepository) {}

  async listGuardians(input: ListGuardiansQuery & { institutionId: string }) {
    const result = await this.guardiansRepository.list({
      ...input,
      search: input.search?.trim() || undefined,
    });

    return {
      data: result.items.map((guardian) => this.toGuardianResponse(guardian)),
      meta: {
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async getGuardian(institutionId: string, guardianId: string) {
    const guardian = await this.guardiansRepository.findById(
      institutionId,
      guardianId
    );

    if (!guardian) {
      throw new GuardiansServiceError('Guardian not found', 404);
    }

    return {
      data: this.toGuardianResponse(guardian),
    };
  }

  async createGuardian(input: CreateGuardianBody & { institutionId: string }) {
    const guardian = await this.guardiansRepository.create({
      institutionId: input.institutionId,
      name: input.name.trim(),
      phone:
        input.phone === undefined
          ? null
          : input.phone === null
            ? null
            : input.phone.trim() || null,
    });

    return {
      data: this.toGuardianResponse(guardian),
    };
  }

  async updateGuardian(
    input: UpdateGuardianBody & {
      institutionId: string;
      guardianId: string;
    }
  ) {
    const existingGuardian = await this.guardiansRepository.findById(
      input.institutionId,
      input.guardianId
    );

    if (!existingGuardian) {
      throw new GuardiansServiceError('Guardian not found', 404);
    }

    const updatedGuardian = await this.guardiansRepository.update({
      institutionId: input.institutionId,
      guardianId: input.guardianId,
      name: input.name?.trim(),
      phone:
        input.phone === undefined
          ? undefined
          : input.phone === null
            ? null
            : input.phone.trim() || null,
    });

    if (!updatedGuardian) {
      throw new GuardiansServiceError('Guardian not found', 404);
    }

    return {
      data: this.toGuardianResponse(updatedGuardian),
    };
  }

  async deleteGuardian(institutionId: string, guardianId: string) {
    const guardian = await this.guardiansRepository.findById(
      institutionId,
      guardianId
    );

    if (!guardian) {
      throw new GuardiansServiceError('Guardian not found', 404);
    }

    const linkedStudentCount = await this.guardiansRepository.countLinkedStudents(
      institutionId,
      guardianId
    );

    if (linkedStudentCount > 0) {
      throw new GuardiansServiceError(
        'Guardian cannot be deleted while linked to students',
        409
      );
    }

    await this.guardiansRepository.delete(institutionId, guardianId);

    return {
      data: {
        id: guardianId,
        deleted: true,
      },
    };
  }

  async listStudentGuardians(institutionId: string, studentId: string) {
    const student = await this.guardiansRepository.findStudentById(
      institutionId,
      studentId
    );

    if (!student) {
      throw new GuardiansServiceError('Student not found', 404);
    }

    const guardians = await this.guardiansRepository.listStudentGuardians(
      institutionId,
      studentId
    );

    return {
      data: guardians.map((guardian) => this.toGuardianResponse(guardian)),
    };
  }

  async linkGuardianToStudent(
    institutionId: string,
    studentId: string,
    guardianId: string
  ) {
    const student = await this.guardiansRepository.findStudentById(
      institutionId,
      studentId
    );

    if (!student) {
      throw new GuardiansServiceError('Student not found', 404);
    }

    const guardian = await this.guardiansRepository.findById(
      institutionId,
      guardianId
    );

    if (!guardian) {
      throw new GuardiansServiceError('Guardian not found', 404);
    }

    const existingLink = await this.guardiansRepository.findStudentGuardianLink(
      institutionId,
      studentId,
      guardianId
    );

    if (existingLink) {
      throw new GuardiansServiceError(
        'Guardian is already linked to this student',
        409
      );
    }

    await this.guardiansRepository.addGuardianToStudent(studentId, guardianId);

    return {
      data: {
        studentId,
        guardian: this.toGuardianResponse(guardian),
      },
    };
  }

  async unlinkGuardianFromStudent(
    institutionId: string,
    studentId: string,
    guardianId: string
  ) {
    const student = await this.guardiansRepository.findStudentById(
      institutionId,
      studentId
    );

    if (!student) {
      throw new GuardiansServiceError('Student not found', 404);
    }

    const guardian = await this.guardiansRepository.findById(
      institutionId,
      guardianId
    );

    if (!guardian) {
      throw new GuardiansServiceError('Guardian not found', 404);
    }

    const existingLink = await this.guardiansRepository.findStudentGuardianLink(
      institutionId,
      studentId,
      guardianId
    );

    if (!existingLink) {
      throw new GuardiansServiceError(
        'Guardian link for this student was not found',
        404
      );
    }

    await this.guardiansRepository.removeGuardianFromStudent(
      institutionId,
      studentId,
      guardianId
    );

    return {
      data: {
        studentId,
        guardianId,
        deleted: true,
      },
    };
  }

  private toGuardianResponse(guardian: GuardianRecord) {
    return {
      id: guardian.id,
      institutionId: guardian.institutionId,
      name: guardian.name,
      phone: guardian.phone,
    };
  }
}
