/** Temporary claim-specific holds pending independent source reconciliation.
 * These are not decisions and do not alter evidence or its audit history.
 */
const holds: Record<string, string> = {
  cmwlwwvdr0002zitvryebz8z9: 'Hold: IIT Kanpur DoAA Manual and undated UG programme page disagree about the programme list. Reconcile the controlling source before approval.',
  cmwlwwve00004zitvxjrz3y8f: 'Hold: IIT Kanpur admissions evidence was derived from the same unresolved DoAA Manual versus undated UG page discrepancy. Reconcile before approval.',
};

export function evidenceReviewHold(evidenceId: string): string | null {
  return holds[evidenceId] ?? null;
}
