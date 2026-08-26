import { prisma } from "../lib/prisma.js";
import { getExerciseById } from "./exercise.service.js";
import { findBestVolumeSet, findTopSet } from "./set-log.utils.js";

type MovementType = "COMPOUND" | "ISOLATION";

const COMPOUND_INCREMENT = 2.5;
const ISOLATION_INCREMENT = 1;

export function calculateEstimated1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
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

  const sessionsById = new Map<string, { date: Date; logs: typeof logs }>();
  for (const log of logs) {
    const entry = sessionsById.get(log.sessionId);
    if (entry) {
      entry.logs.push(log);
    } else {
      sessionsById.set(log.sessionId, { date: log.session.startedAt, logs: [log] });
    }
  }

  const orderedSessions = Array.from(sessionsById.entries()).sort(
    ([, a], [, b]) => a.date.getTime() - b.date.getTime(),
  );

  const bestSet = findTopSet(logs);
  const bestVolumeSet = findBestVolumeSet(logs);

  const sessions = orderedSessions.map(([sessionId, { date, logs: sessionLogs }]) => {
    const sessionTopSet = findTopSet(sessionLogs)!;

    return {
      sessionId,
      date,
      sets: sessionLogs.map((log) => ({
        id: log.id,
        weightKg: log.weightKg,
        reps: log.reps,
        rir: log.rir,
        estimated1RM: calculateEstimated1RM(log.weightKg, log.reps),
        isTopOfDay: log.id === sessionTopSet.id,
      })),
      isNewPR: sessionTopSet.id === bestSet?.id,
    };
  });

  const summary = {
    sessionCount: sessions.length,
    bestWeightKg: bestSet?.weightKg ?? null,
    bestVolumeSet: bestVolumeSet ? { weightKg: bestVolumeSet.weightKg, reps: bestVolumeSet.reps } : null,
  };

  const status = await computeProgressStatus(userId, exerciseId, exercise.movementType as MovementType);

  return { summary, sessions, ...status };
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
