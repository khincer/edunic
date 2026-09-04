import {
  computeAverage,
  buildSubjectAverages,
  toRoundedAverage,
  type GradeRow,
} from '@edunic/source/domain/shared';

describe('computeAverage', () => {
  it('returns null for empty grades', () => {
    expect(computeAverage([])).toBeNull();
  });

  it('computes average for a single grade', () => {
    expect(computeAverage([{ score: 80, subject: 'Math' }])).toBe(80);
  });

  it('computes average for multiple grades', () => {
    const grades: GradeRow[] = [
      { score: 80, subject: 'Math' },
      { score: 90, subject: 'Math' },
    ];
    expect(computeAverage(grades)).toBe(85);
  });

  it('rounds to 2 decimal places', () => {
    const grades: GradeRow[] = [
      { score: 70, subject: 'Math' },
      { score: 80, subject: 'Math' },
      { score: 90, subject: 'Math' },
    ];
    expect(computeAverage(grades)).toBe(80);
  });

  it('handles decimal scores', () => {
    const grades: GradeRow[] = [
      { score: 33.33, subject: 'Science' },
      { score: 66.67, subject: 'Science' },
    ];
    expect(computeAverage(grades)).toBe(50);
  });
});

describe('buildSubjectAverages', () => {
  it('returns empty array for no grades', () => {
    expect(buildSubjectAverages([])).toEqual([]);
  });

  it('groups grades by subject and computes averages', () => {
    const grades: GradeRow[] = [
      { score: 80, subject: 'Math' },
      { score: 90, subject: 'Math' },
      { score: 70, subject: 'Science' },
      { score: 90, subject: 'Science' },
    ];

    const result = buildSubjectAverages(grades);

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.subject === 'Math')?.average).toBe(85);
    expect(result.find((s) => s.subject === 'Science')?.average).toBe(80);
  });

  it('returns results sorted alphabetically by subject', () => {
    const grades: GradeRow[] = [
      { score: 90, subject: 'Zoology' },
      { score: 80, subject: 'Art' },
      { score: 70, subject: 'Math' },
    ];

    const result = buildSubjectAverages(grades);
    expect(result.map((s) => s.subject)).toEqual(['Art', 'Math', 'Zoology']);
  });

  it('handles single subject', () => {
    const grades: GradeRow[] = [{ score: 85, subject: 'History' }];
    const result = buildSubjectAverages(grades);

    expect(result).toEqual([{ subject: 'History', average: 85 }]);
  });
});

describe('toRoundedAverage', () => {
  it('returns null for zero count', () => {
    expect(toRoundedAverage({ total: 0, count: 0 })).toBeNull();
  });

  it('computes and rounds average', () => {
    expect(toRoundedAverage({ total: 250, count: 3 })).toBe(83.33);
  });

  it('returns integer when divisible', () => {
    expect(toRoundedAverage({ total: 200, count: 2 })).toBe(100);
  });
});
