/** Temporary claim-specific holds pending independent source reconciliation.
 * These are not decisions and do not alter evidence or its audit history.
 */
const holds: Record<string, string> = {
  cmwlqtg7i001qgvtvfvd0j4ev: 'The closed 2026 All India cycle limits the school location and equivalent qualifications. The staged summary omits those conditions. Reconcile the scope and mark the cycle historical before review.',
  cmwlpjrzh001syttvn05nz1d4: 'The publisher describes the proposed 2026–27 tuition as subject to appellate consideration and revision. Confirm the final applicable schedule.',
  cmwm3rj75000bhxtvbr105oe7: 'Inspect the complete 2024–25 annual report and reconcile the placed and eligible totals on printed page 11 before publishing.',
  cmwm3rj78000dhxtvxa99f78a: 'This Computer Science and Engineering count uses the same unavailable 2024–25 report. Inspect the department row and eligible cohort on printed page 11 before publishing.',
  cmwkzioa60002b9tvn4vb7p89: 'Institution mismatch: the archived OPJU domain belongs to the Raigarh university. This catalogue record is for O.P. Jindal Global University in Sonipat.',
  cmwkz9wpo0022fbtvxixkrfep: 'Institution mismatch: the archived OPJU domain belongs to the Raigarh university. This catalogue record is for O.P. Jindal Global University in Sonipat.',
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
