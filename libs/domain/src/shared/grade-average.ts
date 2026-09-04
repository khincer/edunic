export type GradeRow = {
  score: number;
  subject: string;
};

export type AverageBucket = {
  total: number;
  count: number;
};

export function toRoundedAverage(bucket: AverageBucket): number | null {
  if (bucket.count === 0) return null;
  return Number((bucket.total / bucket.count).toFixed(2));
}

export function computeAverage(grades: GradeRow[]): number | null {
  if (grades.length === 0) return null;
  const total = grades.reduce((sum, grade) => sum + grade.score, 0);
  return toRoundedAverage({ total, count: grades.length });
}

export function buildSubjectAverages(
  grades: GradeRow[]
): { subject: string; average: number | null }[] {
  const buckets = new Map<string, AverageBucket>();

  for (const grade of grades) {
    const bucket = buckets.get(grade.subject) ?? { total: 0, count: 0 };
    bucket.total += grade.score;
    bucket.count += 1;
    buckets.set(grade.subject, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([subject, bucket]) => ({
      subject,
      average: toRoundedAverage(bucket),
    }));
}
