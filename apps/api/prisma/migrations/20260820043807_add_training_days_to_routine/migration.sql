-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "trainingDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
