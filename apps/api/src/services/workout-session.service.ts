import { prisma } from "../lib/prisma.js";
import { getExerciseById } from "./exercise.service.js";
import { getRoutineById } from "./routine.service.js";

export class SessionNotFoundError extends Error {
  constructor() {
    super("Sesión no encontrada");
    this.name = "SessionNotFoundError";
  }
}

export class SetLogNotFoundError extends Error {
  constructor() {
    super("Serie no encontrada");
    this.name = "SetLogNotFoundError";
  }
}

export class SessionAlreadyFinishedError extends Error {
  constructor() {
    super("La sesión ya está finalizada");
    this.name = "SessionAlreadyFinishedError";
  }
}

type CreateSessionInput = { routineId?: string };

export async function createSession(userId: string, input: CreateSessionInput) {
  if (input.routineId) {
    await getRoutineById(userId, input.routineId);
  }

  return prisma.workoutSession.create({
    data: { userId, routineId: input.routineId ?? null },
  });
}

export async function listSessionsForUser(userId: string) {
  return prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });
}

async function findOwnedSession(userId: string, id: string) {
  const session = await prisma.workoutSession.findUnique({ where: { id } });
  if (!session || session.userId !== userId) {
    throw new SessionNotFoundError();
  }
  return session;
}

function assertSessionOpen(session: { finishedAt: Date | null }) {
  if (session.finishedAt !== null) {
    throw new SessionAlreadyFinishedError();
  }
}

export async function getSessionById(userId: string, id: string) {
  await findOwnedSession(userId, id);

  return prisma.workoutSession.findUnique({
    where: { id },
    include: {
      setLogs: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function finishSession(userId: string, id: string) {
  const session = await findOwnedSession(userId, id);
  assertSessionOpen(session);

  return prisma.workoutSession.update({
    where: { id },
    data: { finishedAt: new Date() },
  });
}

export async function deleteSession(userId: string, id: string) {
  await findOwnedSession(userId, id);
  await prisma.workoutSession.delete({ where: { id } });
}

type AddSetLogInput = {
  exerciseId: string;
  weightKg: number;
  reps: number;
  rir?: number | null;
  note?: string | null;
};

export async function addSetLog(userId: string, sessionId: string, input: AddSetLogInput) {
  const session = await findOwnedSession(userId, sessionId);
  assertSessionOpen(session);

  await getExerciseById(userId, input.exerciseId);

  const existingCount = await prisma.setLog.count({
    where: { sessionId, exerciseId: input.exerciseId },
  });

  return prisma.setLog.create({
    data: {
      sessionId,
      exerciseId: input.exerciseId,
      setNumber: existingCount + 1,
      weightKg: input.weightKg,
      reps: input.reps,
      rir: input.rir ?? null,
      note: input.note ?? null,
    },
  });
}

async function findOwnedSetLog(userId: string, sessionId: string, logId: string) {
  const session = await findOwnedSession(userId, sessionId);

  const log = await prisma.setLog.findUnique({ where: { id: logId } });
  if (!log || log.sessionId !== sessionId) {
    throw new SetLogNotFoundError();
  }

  return { session, log };
}

type UpdateSetLogInput = Partial<{
  weightKg: number;
  reps: number;
  rir: number | null;
  note: string | null;
}>;

export async function updateSetLog(
  userId: string,
  sessionId: string,
  logId: string,
  input: UpdateSetLogInput,
) {
  const { session } = await findOwnedSetLog(userId, sessionId, logId);
  assertSessionOpen(session);

  return prisma.setLog.update({ where: { id: logId }, data: input });
}

export async function deleteSetLog(userId: string, sessionId: string, logId: string) {
  const { session } = await findOwnedSetLog(userId, sessionId, logId);
  assertSessionOpen(session);

  await prisma.setLog.delete({ where: { id: logId } });
}
