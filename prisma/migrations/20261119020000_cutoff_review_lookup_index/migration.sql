-- Supports the latest-decision lookup for each published cutoff. Concurrent
-- creation keeps writes available when this additive index is applied to a
-- populated database. The predicate is omitted so the Prisma schema matches.
CREATE INDEX CONCURRENTLY "EvidenceDecision_cutoffId_createdAt_id_idx"
  ON "EvidenceDecision"("cutoffId", "createdAt" DESC, "id" DESC);
