import { prisma } from "../lib/prisma.js";
import { getReadyToProgressForUser } from "./progress.service.js";

const RECENT_SESSIONS_LIMIT = 5;

export async function getDashboard(userId: string) {
  const [recentSessionsRaw, routines, readyToProgress] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: RECENT_SESSIONS_LIMIT,
      include: { routine: { select: { name: true } } },
    }),
    prisma.routine.findMany({
      where: { userId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getReadyToProgressForUser(userId),
  ]);

  const recentSessions = recentSessionsRaw.map((session) => ({
    id: session.id,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    routineId: session.routineId,
    routineName: session.routine?.name ?? null,
  }));

  return { recentSessions, routines, readyToProgress };
}
