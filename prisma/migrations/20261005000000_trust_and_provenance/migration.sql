-- Trust & provenance migration.
--
-- Safe to run on the existing production database: users, saved colleges,
-- saved comparisons, questions and answers are preserved. College IDs are
-- preserved so existing saved items keep working.
--
-- Every College row that exists before this migration was hand-typed demo
-- data (see docs/AUDIT.md). This migration therefore:
--   * marks those rows DEMO,
--   * deletes contact details that were generated with Math.random()
--     or invented domains (they could route students to strangers),
--   * deletes the static fake rating/reviewCount,
--   * drops the invented single-number cutoffRanks JSON.

-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('DEMO', 'UNVERIFIED', 'VERIFIED');
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "ModerationStatus" AS ENUM ('VISIBLE', 'HIDDEN');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "Exam" AS ENUM ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'CAT', 'GATE');
CREATE TYPE "CutoffMetric" AS ENUM ('RANK', 'PERCENTILE', 'SCORE');
CREATE TYPE "SeatCategory" AS ENUM ('OPEN', 'EWS', 'OBC_NCL', 'SC', 'ST');
CREATE TYPE "SeatPool" AS ENUM ('GENDER_NEUTRAL', 'FEMALE_ONLY');

-- College: relax NOT NULL on values that may legitimately be unknown
ALTER TABLE "College"
    ALTER COLUMN "establishedYear" DROP NOT NULL,
    ALTER COLUMN "totalStudents" DROP NOT NULL,
    ALTER COLUMN "naacGrade" DROP NOT NULL,
    ALTER COLUMN "annualFees" DROP NOT NULL,
    ALTER COLUMN "placementPct" DROP NOT NULL,
    ALTER COLUMN "avgPackage" DROP NOT NULL,
    ALTER COLUMN "highestPackage" DROP NOT NULL,
    ALTER COLUMN "topRecruiters" SET DEFAULT ARRAY[]::TEXT[],
    ALTER COLUMN "courses" SET DEFAULT ARRAY[]::TEXT[],
    ALTER COLUMN "description" DROP NOT NULL,
    ALTER COLUMN "about" DROP NOT NULL,
    ALTER COLUMN "website" DROP NOT NULL,
    ALTER COLUMN "phone" DROP NOT NULL,
    ALTER COLUMN "email" DROP NOT NULL,
    ALTER COLUMN "rating" DROP NOT NULL,
    ALTER COLUMN "reviewCount" SET DEFAULT 0;

ALTER TABLE "College"
    ADD COLUMN "slug" TEXT,
    ADD COLUMN "metricsYear" INTEGER,
    ADD COLUMN "dataStatus" "DataStatus" NOT NULL DEFAULT 'UNVERIFIED',
    ADD COLUMN "aisheCode" TEXT;

-- Backfill slugs from the full name; disambiguate collisions deterministically.
WITH base AS (
    SELECT "id",
           COALESCE(NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'college') AS s
    FROM "College"
), numbered AS (
    SELECT "id", s, row_number() OVER (PARTITION BY s ORDER BY "id") AS n FROM base
)
UPDATE "College" c
SET "slug" = CASE WHEN numbered.n = 1 THEN numbered.s ELSE numbered.s || '-' || numbered.n END
FROM numbered
WHERE c."id" = numbered."id";

ALTER TABLE "College" ALTER COLUMN "slug" SET NOT NULL;

-- Scrub fabricated values on pre-existing rows (all of them were demo data).
UPDATE "College"
SET "dataStatus" = 'DEMO',
    "website" = NULL,
    "phone" = NULL,
    "email" = NULL,
    "rating" = NULL,
    "reviewCount" = 0,
    "about" = NULL,
    "description" = NULL;

ALTER TABLE "College" DROP COLUMN "cutoffRanks";

-- User
ALTER TABLE "User"
    ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
    ADD COLUMN "emailVerified" TIMESTAMP(3),
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Moderation
ALTER TABLE "Question" ADD COLUMN "status" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE';
ALTER TABLE "Answer" ADD COLUMN "status" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE';

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degree" TEXT,
    "branch" TEXT,
    "durationYears" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "license" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CutoffRecord" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "exam" "Exam" NOT NULL,
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "quota" TEXT NOT NULL,
    "category" "SeatCategory" NOT NULL,
    "isPwd" BOOLEAN NOT NULL DEFAULT false,
    "seatPool" "SeatPool" NOT NULL,
    "metric" "CutoffMetric" NOT NULL DEFAULT 'RANK',
    "openingValue" DOUBLE PRECISION,
    "closingValue" DOUBLE PRECISION NOT NULL,
    "isPreparatory" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CutoffRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeesRecord" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "programId" TEXT,
    "year" INTEGER NOT NULL,
    "amountInr" INTEGER NOT NULL,
    "feeType" TEXT NOT NULL,
    "notes" TEXT,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementRecord" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "programId" TEXT,
    "year" INTEGER NOT NULL,
    "graduating" INTEGER,
    "placed" INTEGER,
    "medianSalaryInr" INTEGER,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NirfRanking" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NirfRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "College_slug_key" ON "College"("slug");
CREATE UNIQUE INDEX "College_aisheCode_key" ON "College"("aisheCode");
CREATE INDEX "College_name_idx" ON "College"("name");

CREATE INDEX "Program_collegeId_idx" ON "Program"("collegeId");
CREATE INDEX "Program_branch_idx" ON "Program"("branch");
CREATE UNIQUE INDEX "Program_collegeId_name_key" ON "Program"("collegeId", "name");

CREATE INDEX "Source_publisher_idx" ON "Source"("publisher");

CREATE INDEX "CutoffRecord_exam_category_seatPool_year_idx" ON "CutoffRecord"("exam", "category", "seatPool", "year");
CREATE INDEX "CutoffRecord_programId_idx" ON "CutoffRecord"("programId");
CREATE INDEX "CutoffRecord_sourceId_idx" ON "CutoffRecord"("sourceId");
CREATE UNIQUE INDEX "CutoffRecord_natural_key" ON "CutoffRecord"("programId", "exam", "year", "round", "quota", "category", "isPwd", "seatPool");

CREATE INDEX "FeesRecord_collegeId_year_idx" ON "FeesRecord"("collegeId", "year");
CREATE INDEX "FeesRecord_programId_idx" ON "FeesRecord"("programId");
CREATE INDEX "FeesRecord_sourceId_idx" ON "FeesRecord"("sourceId");

CREATE INDEX "PlacementRecord_collegeId_year_idx" ON "PlacementRecord"("collegeId", "year");
CREATE INDEX "PlacementRecord_programId_idx" ON "PlacementRecord"("programId");
CREATE INDEX "PlacementRecord_sourceId_idx" ON "PlacementRecord"("sourceId");

CREATE INDEX "NirfRanking_year_category_rank_idx" ON "NirfRanking"("year", "category", "rank");
CREATE INDEX "NirfRanking_sourceId_idx" ON "NirfRanking"("sourceId");
CREATE UNIQUE INDEX "NirfRanking_collegeId_year_category_key" ON "NirfRanking"("collegeId", "year", "category");

CREATE INDEX "Review_collegeId_status_idx" ON "Review"("collegeId", "status");
CREATE UNIQUE INDEX "Review_collegeId_userId_key" ON "Review"("collegeId", "userId");

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CutoffRecord" ADD CONSTRAINT "CutoffRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CutoffRecord" ADD CONSTRAINT "CutoffRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeesRecord" ADD CONSTRAINT "FeesRecord_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeesRecord" ADD CONSTRAINT "FeesRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeesRecord" ADD CONSTRAINT "FeesRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlacementRecord" ADD CONSTRAINT "PlacementRecord_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementRecord" ADD CONSTRAINT "PlacementRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacementRecord" ADD CONSTRAINT "PlacementRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NirfRanking" ADD CONSTRAINT "NirfRanking_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NirfRanking" ADD CONSTRAINT "NirfRanking_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
