ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "timeZone" TEXT;
ALTER TABLE "Question" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "Answer" ADD COLUMN "contentHash" TEXT;

CREATE TABLE "CommunityReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "questionId" TEXT,
  "answerId" TEXT,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolutionReason" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityReport_one_target_check" CHECK (("questionId" IS NOT NULL)::int + ("answerId" IS NOT NULL)::int = 1)
);

CREATE UNIQUE INDEX "CommunityReport_reporterId_questionId_key" ON "CommunityReport"("reporterId", "questionId");
CREATE UNIQUE INDEX "CommunityReport_reporterId_answerId_key" ON "CommunityReport"("reporterId", "answerId");
CREATE INDEX "CommunityReport_status_createdAt_id_idx" ON "CommunityReport"("status", "createdAt", "id");
CREATE INDEX "CommunityReport_questionId_status_idx" ON "CommunityReport"("questionId", "status");
CREATE INDEX "CommunityReport_answerId_status_idx" ON "CommunityReport"("answerId", "status");
CREATE INDEX "Question_collegeId_status_createdAt_id_idx" ON "Question"("collegeId", "status", "createdAt" DESC, "id");
CREATE INDEX "Answer_questionId_status_createdAt_id_idx" ON "Answer"("questionId", "status", "createdAt", "id");
CREATE UNIQUE INDEX "Question_userId_collegeId_contentHash_key" ON "Question"("userId", "collegeId", "contentHash");
CREATE UNIQUE INDEX "Answer_userId_questionId_contentHash_key" ON "Answer"("userId", "questionId", "contentHash");

ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
