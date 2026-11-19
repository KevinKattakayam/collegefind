import { z } from 'zod';

export const historicalRank = z.string().trim().regex(/^\d{1,7}$/).transform(Number).pipe(z.number().int().min(1).max(3_000_000));

export function compareHistoricalRank(rank: number, opening: number | null, closing: number) {
  if (rank > closing) return 'Your rank number is higher than the published closing rank.';
  if (rank === closing) return 'Your rank number equals the published closing rank.';
  if (opening !== null && rank < opening) return 'Your rank number is lower than the published opening rank.';
  if (opening === null) return 'Your rank number is lower than the published closing rank. An opening rank was not published.';
  return 'Your rank number is within the published opening and closing range.';
}
