-- CreateTable
CREATE TABLE "AdmissionPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "authority" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChoice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "collegeId" TEXT,
    "programId" TEXT,
    "cycle" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanApplication" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "choiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INTERESTED',
    "cycle" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "note" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "timeZone" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionPlan_userId_updatedAt_id_idx" ON "AdmissionPlan"("userId", "updatedAt" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPlan_userId_name_cycle_key" ON "AdmissionPlan"("userId", "name", "cycle");

-- CreateIndex
CREATE INDEX "PlanChoice_planId_cycle_position_idx" ON "PlanChoice"("planId", "cycle", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlanChoice_planId_cycle_label_key" ON "PlanChoice"("planId", "cycle", "label");

-- CreateIndex
CREATE UNIQUE INDEX "PlanChoice_planId_position_key" ON "PlanChoice"("planId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlanApplication_choiceId_key" ON "PlanApplication"("choiceId");

-- CreateIndex
CREATE INDEX "PlanApplication_planId_status_updatedAt_idx" ON "PlanApplication"("planId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "PlanTask_planId_completedAt_dueAt_idx" ON "PlanTask"("planId", "completedAt", "dueAt");

-- AddForeignKey
ALTER TABLE "AdmissionPlan" ADD CONSTRAINT "AdmissionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChoice" ADD CONSTRAINT "PlanChoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdmissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChoice" ADD CONSTRAINT "PlanChoice_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChoice" ADD CONSTRAINT "PlanChoice_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApplication" ADD CONSTRAINT "PlanApplication_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdmissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanApplication" ADD CONSTRAINT "PlanApplication_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "PlanChoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTask" ADD CONSTRAINT "PlanTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AdmissionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
