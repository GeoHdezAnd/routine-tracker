import { prisma } from "../lib/prisma.js";
import { getExerciseById } from "./exercise.service.js";

type MovementType = "COMPOUND" | "ISOLATION";

const COMPOUND_INCREMENT = 2.5;
const ISOLATION_INCREMENT = 1;

export function calculateEstimated1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

type TopSetCandidate = { weightKg: number; reps: number };

function findTopSet<T extends TopSetCandidate>(logs: T[]): T | undefined {
  return logs.reduce<T | undefined>((best, log) => {
    if (!best) return log;
    if (log.weightKg > best.weightKg) return log;
    if (log.weightKg === best.weightKg && log.reps > best.reps) return log;
    return best;
  }, undefined);
}

type ProgressStatus = { readyToProgress: boolean; suggestedWeightIncrease: number | null };

async function computeProgressStatus(
  userId: string,
  exerciseId: string,
  movementType: MovementType,
): Promise<ProgressStatus> {
  const candidateSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      finishedAt: { not: null },
      routineId: { not: null },
      routine: { exercises: { some: { exerciseId } } },
    },
    orderBy: { startedAt: "desc" },
    take: 2,
    include: {
      routine: { include: { exercises: { where: { exerciseId } } } },
      setLogs: { where: { exerciseId } },
    },
  });

  if (candidateSessions.length < 2) {
    return { readyToProgress: false, suggestedWeightIncrease: null };
  }

  const evaluations = candidateSessions.map((session) => ({
    topSet: findTopSet(session.setLogs),
    targetRepMax: session.routine?.exercises[0]?.targetRepMax,
  }));

  const [a, b] = evaluations;
  if (!a || !b || !a.topSet || !b.topSet || a.targetRepMax === undefined || b.targetRepMax === undefined) {
    return { readyToProgress: false, suggestedWeightIncrease: null };
  }

  const readyToProgress =
    a.topSet.weightKg === b.topSet.weightKg && a.topSet.reps >= a.targetRepMax && b.topSet.reps >= b.targetRepMax;

  return {
    readyToProgress,
    suggestedWeightIncrease: readyToProgress
      ? movementType === "COMPOUND"
        ? COMPOUND_INCREMENT
        : ISOLATION_INCREMENT
      : null,
  };
}

export async function getExerciseProgress(userId: string, exerciseId: string) {
  const exercise = await getExerciseById(userId, exerciseId);

  const logs = await prisma.setLog.findMany({
    where: { exerciseId, session: { userId } },
    orderBy: { createdAt: "asc" },
    include: { session: { select: { startedAt: true } } },
  });

  const history = logs.map((log) => ({
    sessionId: log.sessionId,
    date: log.session.startedAt,
    weightKg: log.weightKg,
    reps: log.reps,
    rir: log.rir,
    estimated1RM: calculateEstimated1RM(log.weightKg, log.reps),
  }));

  const status = await computeProgressStatus(userId, exerciseId, exercise.movementType as MovementType);

  return { history, ...status };
}

export async function getReadyToProgressForUser(userId: string) {
  const loggedExercises = await prisma.setLog.findMany({
    where: { session: { userId } },
    select: { exerciseId: true },
    distinct: ["exerciseId"],
  });

  const results: { exerciseId: string; exerciseName: string; suggestedWeightIncrease: number }[] = [];

  for (const { exerciseId } of loggedExercises) {
    const exercise = await prisma.exercise.findUniqueOrThrow({ where: { id: exerciseId } });
    const status = await computeProgressStatus(userId, exerciseId, exercise.movementType as MovementType);
    if (status.readyToProgress && status.suggestedWeightIncrease !== null) {
      results.push({
        exerciseId,
        exerciseName: exercise.name,
        suggestedWeightIncrease: status.suggestedWeightIncrease,
      });
    }
  }

  return results;
}
