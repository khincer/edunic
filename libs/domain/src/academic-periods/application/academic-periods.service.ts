import {
  buildCursorPage,
  type FilterSpec,
  type SortSpec,
} from '@edunic/source/domain/shared';
import type {
  CreateAcademicPeriodBody,
  ListAcademicPeriodsQuery,
  UpdateAcademicPeriodBody,
} from '../schemas/academic-period.schemas.js';
import {
  AcademicPeriodsRepository,
  type AcademicPeriodRecord,
} from '../infrastructure/academic-periods.repository.js';

export class AcademicPeriodsServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'AcademicPeriodsServiceError';
  }
}

export class AcademicPeriodsService {
  constructor(
    private readonly academicPeriodsRepository: AcademicPeriodsRepository
  ) {}

  async listAcademicPeriods(
    input: ListAcademicPeriodsQuery & {
      filters?: FilterSpec[];
      sort?: SortSpec | null;
    }
  ) {
    const result = await this.academicPeriodsRepository.list(input);

    const page = buildCursorPage(
      result.items,
      input,
      {
        sortKey: (academicPeriod) => academicPeriod.year,
        id: (academicPeriod) => academicPeriod.id,
      },
      result.total
    );

    return {
      data: page.data.map((academicPeriod) =>
        this.toAcademicPeriodResponse(academicPeriod)
      ),
      hasMore: page.hasMore,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
      ...(page.meta !== undefined ? { meta: page.meta } : {}),
    };
  }

  async getAcademicPeriod(academicPeriodId: string) {
    const academicPeriod = await this.academicPeriodsRepository.findById(academicPeriodId);

    if (!academicPeriod) {
      throw new AcademicPeriodsServiceError('Academic period not found', 404);
    }

    return {
      data: this.toAcademicPeriodResponse(academicPeriod),
    };
  }

  async createAcademicPeriod(
    input: CreateAcademicPeriodBody
  ) {
    const existingAcademicPeriod =
      await this.academicPeriodsRepository.findByYearAndTerm(input.year, input.term);

    if (existingAcademicPeriod) {
      throw new AcademicPeriodsServiceError(
        'Academic period already exists for this year and term',
        409
      );
    }

    const createdAcademicPeriod = await this.academicPeriodsRepository.create({
      year: input.year,
      term: input.term,
      startDate: input.startDate,
      endDate: input.endDate,
    });

    const academicPeriod = await this.academicPeriodsRepository.findById(createdAcademicPeriod.id);

    if (!academicPeriod) {
      throw new AcademicPeriodsServiceError('Academic period not found', 404);
    }

    return {
      data: this.toAcademicPeriodResponse(academicPeriod),
    };
  }

  async updateAcademicPeriod(
    input: UpdateAcademicPeriodBody & { academicPeriodId: string }
  ) {
    const existingAcademicPeriod = await this.academicPeriodsRepository.findById(input.academicPeriodId);

    if (!existingAcademicPeriod) {
      throw new AcademicPeriodsServiceError('Academic period not found', 404);
    }

    const nextYear = input.year ?? existingAcademicPeriod.year;
    const nextTerm = input.term ?? existingAcademicPeriod.term;
    const nextStartDate =
      input.startDate === undefined
        ? this.toDate(existingAcademicPeriod.startDate)
        : input.startDate === null
          ? null
          : new Date(input.startDate);
    const nextEndDate =
      input.endDate === undefined
        ? this.toDate(existingAcademicPeriod.endDate)
        : input.endDate === null
          ? null
          : new Date(input.endDate);

    if (
      nextStartDate &&
      nextEndDate &&
      nextStartDate.getTime() > nextEndDate.getTime()
    ) {
      throw new AcademicPeriodsServiceError(
        'Start date must be before or equal to end date',
        400
      );
    }

    const duplicateAcademicPeriod =
      await this.academicPeriodsRepository.findByYearAndTerm(
        nextYear,
        nextTerm,
        input.academicPeriodId
      );

    if (duplicateAcademicPeriod) {
      throw new AcademicPeriodsServiceError(
        'Academic period already exists for this year and term',
        409
      );
    }

    const updatedAcademicPeriod = await this.academicPeriodsRepository.update({
      academicPeriodId: input.academicPeriodId,
      year: input.year,
      term: input.term,
      startDate:
        input.startDate === undefined ? undefined : (input.startDate ?? null),
      endDate: input.endDate === undefined ? undefined : (input.endDate ?? null),
    });

    if (!updatedAcademicPeriod) {
      throw new AcademicPeriodsServiceError('Academic period not found', 404);
    }

    const academicPeriod = await this.academicPeriodsRepository.findById(input.academicPeriodId);

    if (!academicPeriod) {
      throw new AcademicPeriodsServiceError('Academic period not found', 404);
    }

    return {
      data: this.toAcademicPeriodResponse(academicPeriod),
    };
  }

  async deleteAcademicPeriod(academicPeriodId: string) {
    const academicPeriod = await this.academicPeriodsRepository.findById(academicPeriodId);

    if (!academicPeriod) {
      throw new AcademicPeriodsServiceError('Academic period not found', 404);
    }

    const enrollmentCount = await this.academicPeriodsRepository.countEnrollments(academicPeriodId);

    if (enrollmentCount > 0) {
      throw new AcademicPeriodsServiceError(
        'Academic period cannot be deleted while enrollments exist',
        409
      );
    }

    await this.academicPeriodsRepository.delete(academicPeriodId);

    return {
      data: {
        id: academicPeriodId,
        deleted: true,
      },
    };
  }

  private toAcademicPeriodResponse(academicPeriod: AcademicPeriodRecord) {
    return {
      id: academicPeriod.id,
      year: academicPeriod.year,
      term: academicPeriod.term,
      startDate: academicPeriod.startDate,
      endDate: academicPeriod.endDate,
      createdAt: academicPeriod.createdAt,
    };
  }

  private toDate(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value : new Date(value);
  }
}
