/** Temporary claim-specific holds pending independent source reconciliation.
 * These are not decisions and do not alter evidence or its audit history.
 */
const holds: Record<string, string> = {
  cmwlwwvdr0002zitvryebz8z9: 'Hold: IIT Kanpur DoAA Manual and undated UG programme page disagree about the programme list. Reconcile the controlling source before approval.',
  cmwlwwve00004zitvxjrz3y8f: 'Hold: IIT Kanpur admissions evidence was derived from the same unresolved DoAA Manual versus undated UG page discrepancy. Reconcile before approval.',
  "cmwm3rj6a0003hxtvu3e41wts": "SCOPE_COLLISION: four programme-specific MNNIT admission routes share the broad scalar scope “Academic year 2024-25”; this is not evidence that the routes contradict. Keep the group held until each claim has programme-specific scope.",
  "cmwm3rj6j0005hxtv6pgreyrr": "SCOPE_COLLISION: four programme-specific MNNIT admission routes share the broad scalar scope “Academic year 2024-25”; this is not evidence that the routes contradict. Keep the group held until each claim has programme-specific scope.",
  "cmwm3rj6p0007hxtv20ylzhdu": "SCOPE_COLLISION: four programme-specific MNNIT admission routes share the broad scalar scope “Academic year 2024-25”; this is not evidence that the routes contradict. Keep the group held until each claim has programme-specific scope.",
  "cmwm3rj6x0009hxtvbie4s2ya": "SCOPE_COLLISION: four programme-specific MNNIT admission routes share the broad scalar scope “Academic year 2024-25”; this is not evidence that the routes contradict. Keep the group held until each claim has programme-specific scope.",
  "cmwm4trdu000g3otvqdlcaeqg": "HISTORICAL_CYCLE_REVIEW: IIMB policy explicitly applies only to batch 2026-28; decide whether to retain as historical reference, and do not present as current admissions guidance.",
  "cmwm4trdy000i3otv3e8lemjl": "HISTORICAL_CYCLE_REVIEW: IIMB policy explicitly applies only to batch 2026-28; decide whether to retain as historical reference, and do not present as current admissions guidance.",
  "cmwlqtg8d002cgvtvkukfcrtj": "HISTORICAL_CYCLE_REVIEW: source identifies CAT 2025 and MBA 2026-28, including final-year completion by June 2026. Do not present as current-cycle admissions guidance.",
  "cmwm4trdq000e3otv3n56x97j": "SOURCE_USE_REVIEW_REQUIRED: IIMB published policy states site content is copyrighted and reproduction needs permission; retain as unreviewed pending a human determination about concise fact summary/public use.",
};

export function evidenceReviewHold(evidenceId: string): string | null {
  return Object.hasOwn(holds, evidenceId) ? holds[evidenceId] : null;
}
