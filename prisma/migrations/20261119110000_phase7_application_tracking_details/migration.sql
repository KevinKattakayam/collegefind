-- Add student-entered institution and programme context to private applications.
-- All fields are nullable so existing records and rolling deployments remain compatible.
ALTER TABLE "PlanApplication"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "collegeId" TEXT,
  ADD COLUMN "institutionName" TEXT,
  ADD COLUMN "programName" TEXT,
  ADD COLUMN "counsellingDetails" TEXT;

CREATE INDEX "PlanApplication_planId_collegeId_status_idx"
  ON "PlanApplication"("planId", "collegeId", "status");

ALTER TABLE "PlanApplication"
  ADD CONSTRAINT "PlanApplication_collegeId_fkey"
  FOREIGN KEY ("collegeId") REFERENCES "College"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
