CREATE INDEX "EvidenceDecision_evidenceId_createdAt_id_idx" ON "EvidenceDecision" ("evidenceId", "createdAt" DESC, "id" DESC);
CREATE INDEX "FieldEvidence_createdAt_id_idx" ON "FieldEvidence" ("createdAt" DESC, "id" DESC);
