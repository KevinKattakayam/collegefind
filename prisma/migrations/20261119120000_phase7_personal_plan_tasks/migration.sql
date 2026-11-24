ALTER TABLE "PlanTask"
  ADD COLUMN "applicationId" TEXT,
  ADD COLUMN "collegeId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PlanTask_planId_applicationId_idx" ON "PlanTask"("planId", "applicationId");
CREATE INDEX "PlanTask_planId_collegeId_idx" ON "PlanTask"("planId", "collegeId");

ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "PlanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_collegeId_fkey"
  FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
