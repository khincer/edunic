import {
  AcademicPeriodsService,
  AcademicPeriodsServiceError,
} from '@edunic/source/domain/academic-periods';

describe('AcademicPeriodsService', () => {
  it('returns 409 when a duplicate year and term already exist', async () => {
    const repository = {
      findByYearAndTerm: jest.fn().mockResolvedValue({ id: 'period-1' }),
    };

    const service = new AcademicPeriodsService(repository as never);

    await expect(
      service.createAcademicPeriod({
        year: 2026,
        term: 1,
      })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AcademicPeriodsServiceError>>({
        message: 'Academic period already exists for this year and term',
        statusCode: 409,
      })
    );
    expect(repository.findByYearAndTerm).toHaveBeenCalledWith(2026, 1);
  });

  it('looks periods up without a school and returns no institutionId', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'period-1',
        year: 2026,
        term: 1,
        startDate: null,
        endDate: null,
        createdAt: null,
      }),
    };
    const service = new AcademicPeriodsService(repository as never);

    const result = await service.getAcademicPeriod('period-1');

    expect(repository.findById).toHaveBeenCalledWith('period-1');
    expect(result.data).not.toHaveProperty('institutionId');
    expect(result.data).toEqual(
      expect.objectContaining({ id: 'period-1', year: 2026, term: 1 })
    );
  });

  it('excludes the period itself when an update collides on year and term', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'period-1',
        year: 2026,
        term: 1,
        startDate: null,
        endDate: null,
        createdAt: null,
      }),
      findByYearAndTerm: jest.fn().mockResolvedValue({ id: 'period-2' }),
    };
    const service = new AcademicPeriodsService(repository as never);

    await expect(
      service.updateAcademicPeriod({ academicPeriodId: 'period-1', term: 2 })
    ).rejects.toEqual(
      expect.objectContaining<Partial<AcademicPeriodsServiceError>>({
        statusCode: 409,
      })
    );
    expect(repository.findByYearAndTerm).toHaveBeenCalledWith(
      2026,
      2,
      'period-1'
    );
  });

  it('returns 400 when update would produce an invalid date range', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'period-1',
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
