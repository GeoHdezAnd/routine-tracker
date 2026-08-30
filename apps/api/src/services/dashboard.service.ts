import { prisma } from "../lib/prisma.js";
import { getReadyToProgressForUser } from "./progress.service.js";

const RECENT_SESSIONS_LIMIT = 5;
const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function toLocal(date: Date, tzOffsetMinutes: number): Date {
  return new Date(date.getTime() + tzOffsetMinutes * 60_000);
}

function toUtc(localDate: Date, tzOffsetMinutes: number): Date {
  return new Date(localDate.getTime() - tzOffsetMinutes * 60_000);
}

function dayKey(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}

function computeDayStreak(sessionDates: Date[], tzOffsetMinutes: number): number {
  const days = new Set(sessionDates.map((date) => dayKey(toLocal(date, tzOffsetMinutes))));
  let streak = 0;
  const cursor = toLocal(new Date(), tzOffsetMinutes);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function startOfWeek(date: Date, tzOffsetMinutes: number): Date {
  const local = toLocal(date, tzOffsetMinutes);
  const diffFromMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - diffFromMonday);
  local.setUTCHours(0, 0, 0, 0);
  return toUtc(local, tzOffsetMinutes);
}

export async function getDashboard(userId: string, tzOffsetMinutes = 0) {
  const now = new Date();

  const [recentSessionsRaw, routinesRaw, readyToProgress, finishedSessions] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: RECENT_SESSIONS_LIMIT,
      include: {
        routine: { select: { name: true } },
        setLogs: { select: { weightKg: true, reps: true } },
      },
    }),
    prisma.routine.findMany({
      where: { userId, archived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        trainingDays: true,
        muscleGroups: true,
        exercises: { select: { id: true } },
      },
    }),
    getReadyToProgressForUser(userId),
    prisma.workoutSession.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { startedAt: true },
    }),
  ]);

  const recentSessions = recentSessionsRaw.map((session) => ({
    id: session.id,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    routineId: session.routineId,
    routineName: session.routine?.name ?? null,
    durationSeconds: session.finishedAt
      ? Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 1000)
      : null,
    volumeKg: Math.round(session.setLogs.reduce((sum, log) => sum + log.weightKg * log.reps, 0)),
  }));

  const weekStart = startOfWeek(now, tzOffsetMinutes);
  const finishedDates = finishedSessions.map((session) => session.startedAt);

  const todayCode = DAY_CODES[toLocal(now, tzOffsetMinutes).getUTCDay()];
  const todayRoutine = routinesRaw.find((routine) => routine.trainingDays.includes(todayCode));

  return {
    dayStreak: computeDayStreak(finishedDates, tzOffsetMinutes),
    sessionsThisWeek: finishedDates.filter((date) => date >= weekStart).length,
    totalWorkouts: finishedDates.length,
    today: todayRoutine
      ? {
          routineId: todayRoutine.id,
          routineName: todayRoutine.name,
          exerciseCount: todayRoutine.exercises.length,
        }
      : null,
    recentSessions,
    routines: routinesRaw.map(({ id, name, trainingDays, muscleGroups, exercises }) => ({
      id,
      name,
      trainingDays,
      muscleGroups,
      exerciseCount: exercises.length,
    })),
    readyToProgress,
  };
}
