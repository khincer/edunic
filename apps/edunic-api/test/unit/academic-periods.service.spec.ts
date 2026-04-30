import {
  AcademicPeriodsService,
  AcademicPeriodsServiceError,
} from '../../src/modules/academic-periods/application/academic-periods.service.js';

describe('AcademicPeriodsService', () => {
  it('returns 409 when a duplicate year and term already exist', async () => {
    const repository = {
      findByYearAndTerm: jest.fn().mockResolvedValue({ id: 'period-1' }),
    };

    const service = new AcademicPeriodsService(repository as never);

    await expect(
      service.createAcademicPeriod({
        institutionId: 'inst-1',
        year: 2026,
        term: 1,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AcademicPeriodsServiceError>>({
        message: 'Academic period already exists for this year and term',
        statusCode: 409,
      })
    );
  });

  it('returns 400 when update would produce an invalid date range', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'period-1',
        institutionId: 'inst-1',
        year: 2026,
        term: 1,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: null,
      }),
    };

    const service = new AcademicPeriodsService(repository as never);

    await expect(
      service.updateAcademicPeriod({
        institutionId: 'inst-1',
        academicPeriodId: 'period-1',
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-03-01T00:00:00.000Z',
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AcademicPeriodsServiceError>>({
        message: 'Start date must be before or equal to end date',
        statusCode: 400,
      })
    );
  });
});
