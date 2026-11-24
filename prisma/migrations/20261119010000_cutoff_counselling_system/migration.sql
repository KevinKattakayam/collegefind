CREATE TYPE "CounsellingSystem" AS ENUM ('UNSPECIFIED', 'JOSAA', 'CSAB', 'MCC', 'STATE', 'OTHER');
CREATE TYPE "CutoffRankType" AS ENUM ('UNSPECIFIED', 'CRL', 'CATEGORY', 'PWD_CATEGORY', 'MERIT');

ALTER TABLE "CutoffRecord"
  ADD COLUMN "counsellingSystem" "CounsellingSystem" NOT NULL DEFAULT 'UNSPECIFIED',
  ADD COLUMN "rankType" "CutoffRankType" NOT NULL DEFAULT 'UNSPECIFIED';

-- Preserve the existing key while adding counselling-system identity. Existing
-- rows remain UNSPECIFIED; the migration does not guess their system.
DROP INDEX "CutoffRecord_natural_key";
CREATE UNIQUE INDEX "CutoffRecord_natural_key"
  ON "CutoffRecord"("programId", "exam", "year", "round", "quota", "category", "counsellingSystem", "isPwd", "seatPool");
