-- Preserve a per-record location within a cited source without copying source
-- material. Existing history remains valid with a null locator until re-imported.
ALTER TABLE "CutoffRecord" ADD COLUMN "evidenceLocator" TEXT;
