ALTER TABLE "FieldEvidence" ADD COLUMN "isFixture" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "evidenceLocator" TEXT, ADD COLUMN "evidenceSnippet" TEXT;
CREATE TABLE "InstitutionAlias" (
 "id" TEXT PRIMARY KEY, "collegeId" TEXT NOT NULL REFERENCES "College"("id") ON DELETE RESTRICT,
 "namespace" TEXT NOT NULL, "value" TEXT NOT NULL, "campus" TEXT NOT NULL,
 "validFrom" TIMESTAMP(3), "validUntil" TIMESTAMP(3), "sourceUrl" TEXT NOT NULL
);
CREATE UNIQUE INDEX "InstitutionAlias_namespace_value_campus_collegeId_key" ON "InstitutionAlias"("namespace", "value", "campus", "collegeId");
CREATE INDEX "InstitutionAlias_namespace_value_idx" ON "InstitutionAlias"("namespace", "value");
