-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "identityKey" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FieldEvidence" (
    "publishedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "programScope" TEXT,
    "academicYear" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "sourceId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceDecision" (
    "cutoffId" TEXT,
    "feesId" TEXT,
    "placementId" TEXT,
    "rankingId" TEXT,
    "id" TEXT NOT NULL,
    "evidenceId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "issues" JSONB,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldEvidence_identityKey_key" ON "FieldEvidence"("identityKey");

-- CreateIndex
CREATE INDEX "FieldEvidence_collegeId_field_idx" ON "FieldEvidence"("collegeId", "field");

-- CreateIndex
CREATE INDEX "EvidenceDecision_evidenceId_createdAt_idx" ON "EvidenceDecision"("evidenceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRun_identityKey_key" ON "ImportRun"("identityKey");

-- CreateIndex
CREATE INDEX "ImportRun_status_startedAt_idx" ON "ImportRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Source_identityKey_key" ON "Source"("identityKey");

-- AddForeignKey
ALTER TABLE "FieldEvidence" ADD CONSTRAINT "FieldEvidence_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldEvidence" ADD CONSTRAINT "FieldEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldEvidence" ADD CONSTRAINT "FieldEvidence_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "FieldEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_cutoffId_fkey" FOREIGN KEY ("cutoffId") REFERENCES "CutoffRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_feesId_fkey" FOREIGN KEY ("feesId") REFERENCES "FeesRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "PlacementRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "NirfRanking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "FieldEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FieldEvidence" ADD CONSTRAINT "FieldEvidence_validity_check" CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validFrom" <= "validUntil");
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_status_check" CHECK ("status" IN ('STAGED', 'VALIDATED', 'PUBLISHED', 'PARTIAL', 'FAILED'));
ALTER TABLE "EvidenceDecision" ADD CONSTRAINT "EvidenceDecision_one_target_check" CHECK (num_nonnulls("evidenceId", "cutoffId", "feesId", "placementId", "rankingId") = 1);
