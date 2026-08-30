-- CreateTable
CREATE TABLE "RoutinePlanPeriod" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "RoutinePlanPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutinePlanPeriod_routineId_idx" ON "RoutinePlanPeriod"("routineId");

-- AddForeignKey
ALTER TABLE "RoutinePlanPeriod" ADD CONSTRAINT "RoutinePlanPeriod_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
