import { prisma } from "../lib/prisma.js";

type TopSetCandidate = { weightKg: number; reps: number };

export function findTopSet<T extends TopSetCandidate>(logs: T[]): T | undefined {
  return logs.reduce<T | undefined>((best, log) => {
    if (!best) return log;
    if (log.weightKg > best.weightKg) return log;
    if (log.weightKg === best.weightKg && log.reps > best.reps) return log;
    return best;
  }, undefined);
}

type VolumeCandidate = { weightKg: number; reps: number };

export function findBestVolumeSet<T extends VolumeCandidate>(logs: T[]): T | undefined {
  return logs.reduce<T | undefined>((best, log) => {
    if (!best) return log;
    if (log.weightKg * log.reps > best.weightKg * best.reps) return log;
    return best;
  }, undefined);
}

export async function getPersonalRecordsForExercises(
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, { weightKg: number; reps: number }>> {
  if (exerciseIds.length === 0) return new Map();

  const logs = await prisma.setLog.findMany({
    where: { exerciseId: { in: exerciseIds }, session: { userId } },
    select: { exerciseId: true, weightKg: true, reps: true },
  });

  const byExercise = new Map<string, { weightKg: number; reps: number }[]>();
  for (const log of logs) {
    const list = byExercise.get(log.exerciseId) ?? [];
    list.push(log);
    byExercise.set(log.exerciseId, list);
  }

  const result = new Map<string, { weightKg: number; reps: number }>();
  for (const [exerciseId, exerciseLogs] of byExercise) {
    const top = findTopSet(exerciseLogs);
    if (top) result.set(exerciseId, { weightKg: top.weightKg, reps: top.reps });
  }
  return result;
}
