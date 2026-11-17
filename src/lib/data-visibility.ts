/** Public runtime reads hide demo measurements; stored fixtures/identity remain intact. */
export function hideDemoMetrics<T>(value: T): T {
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(hideDemoMetrics) as T;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hideDemoMetrics(item)]));
  if (result.dataStatus === 'DEMO') {
    for (const key of ['annualFees', 'placementPct', 'avgPackage', 'highestPackage', 'naacGrade', 'establishedYear', 'totalStudents', 'metricsYear', 'rating']) {
      if (key in result) result[key] = null;
    }
    if ('topRecruiters' in result) result.topRecruiters = [];
  }
  return result as T;
}
