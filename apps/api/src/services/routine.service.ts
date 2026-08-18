import { prisma } from "../lib/prisma.js";
import { getExerciseById } from "./exercise.service.js";

type MovementType = "COMPOUND" | "ISOLATION";
type Goal = "STRENGTH" | "HYPERTROPHY" | "ENDURANCE";

const REP_RANGE_TABLE: Record<MovementType, Record<Goal, { targetRepMin: number; targetRepMax: number }>> = {
  COMPOUND: {
    STRENGTH: { targetRepMin: 3, targetRepMax: 6 },
    HYPERTROPHY: { targetRepMin: 6, targetRepMax: 12 },
    ENDURANCE: { targetRepMin: 12, targetRepMax: 20 },
  },
  ISOLATION: {
    STRENGTH: { targetRepMin: 6, targetRepMax: 8 },
    HYPERTROPHY: { targetRepMin: 10, targetRepMax: 15 },
    ENDURANCE: { targetRepMin: 15, targetRepMax: 25 },
  },
};

export function suggestRepRange(movementType: MovementType, goal: Goal) {
  return REP_RANGE_TABLE[movementType][goal];
}

export class RoutineNotFoundError extends Error {
  constructor() {
    super("Routine not found");
    this.name = "RoutineNotFoundError";
  }
}

export class RoutineExerciseNotFoundError extends Error {
  constructor() {
    super("Routine exercise not found");
    this.name = "RoutineExerciseNotFoundError";
  }
}

type RoutineInput = { name: string };

export async function createRoutine(userId: string, input: RoutineInput) {
  return prisma.routine.create({ data: { ...input, userId } });
}

export async function listRoutinesForUser(userId: string) {
  return prisma.routine.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

async function findOwnedRoutine(userId: string, id: string) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== userId) {
    throw new RoutineNotFoundError();
  }
  return routine;
}

export async function getRoutineById(userId: string, id: string) {
  await findOwnedRoutine(userId, id);

  return prisma.routine.findUnique({
    where: { id },
    include: {
      exercises: {
        orderBy: [{ order: "asc" }, { supersetSlot: "asc" }],
        include: { exercise: true },
      },
    },
  });
}

export async function updateRoutine(userId: string, id: string, input: Partial<RoutineInput>) {
  await findOwnedRoutine(userId, id);
  return prisma.routine.update({ where: { id }, data: input });
}

export async function deleteRoutine(userId: string, id: string) {
  await findOwnedRoutine(userId, id);
  await prisma.routine.delete({ where: { id } });
}

type AddRoutineExerciseInput = {
  exerciseId: string;
  order: number;
  supersetSlot?: number | null;
  goal: Goal;
  targetSets: number;
  targetRepMin?: number;
  targetRepMax?: number;
};

export async function addExerciseToRoutine(userId: string, routineId: string, input: AddRoutineExerciseInput) {
  await findOwnedRoutine(userId, routineId);

  const exercise = await getExerciseById(userId, input.exerciseId);

  const range =
    input.targetRepMin !== undefined && input.targetRepMax !== undefined
      ? { targetRepMin: input.targetRepMin, targetRepMax: input.targetRepMax }
      : suggestRepRange(exercise.movementType as MovementType, input.goal);

  return prisma.routineExercise.create({
    data: {
      routineId,
      exerciseId: input.exerciseId,
      order: input.order,
      supersetSlot: input.supersetSlot ?? null,
      goal: input.goal,
      targetSets: input.targetSets,
      targetRepMin: range.targetRepMin,
      targetRepMax: range.targetRepMax,
    },
  });
}

async function findOwnedRoutineExercise(userId: string, routineId: string, routineExerciseId: string) {
  await findOwnedRoutine(userId, routineId);

  const routineExercise = await prisma.routineExercise.findUnique({ where: { id: routineExerciseId } });
  if (!routineExercise || routineExercise.routineId !== routineId) {
    throw new RoutineExerciseNotFoundError();
  }
  return routineExercise;
}

type UpdateRoutineExerciseInput = Partial<{
  order: number;
  supersetSlot: number | null;
  goal: Goal;
  targetSets: number;
  targetRepMin: number;
  targetRepMax: number;
}>;

export async function updateRoutineExercise(
  userId: string,
  routineId: string,
  routineExerciseId: string,
  input: UpdateRoutineExerciseInput,
) {
  await findOwnedRoutineExercise(userId, routineId, routineExerciseId);
  return prisma.routineExercise.update({ where: { id: routineExerciseId }, data: input });
}

export async function removeExerciseFromRoutine(userId: string, routineId: string, routineExerciseId: string) {
  await findOwnedRoutineExercise(userId, routineId, routineExerciseId);
  await prisma.routineExercise.delete({ where: { id: routineExerciseId } });
}
