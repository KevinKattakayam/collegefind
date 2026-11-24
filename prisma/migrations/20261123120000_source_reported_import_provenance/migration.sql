ALTER TABLE "FieldEvidence"
  ADD COLUMN "campusScope" TEXT,
  ADD COLUMN "applicablePeriod" TEXT,
  ADD COLUMN "publisherPeriod" TEXT,
  ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceReportedRef" TEXT;

CREATE UNIQUE INDEX "FieldEvidence_sourceReportedRef_key"
  ON "FieldEvidence"("sourceReportedRef");
