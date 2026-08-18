import { prisma } from "../lib/prisma.js";

type MovementType = "COMPOUND" | "ISOLATION";

type ExerciseInput = {
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
};

export class ExerciseNotFoundError extends Error {
  constructor() {
    super("Exercise not found");
    this.name = "ExerciseNotFoundError";
  }
}

export class ExerciseForbiddenError extends Error {
  constructor() {
    super("You do not have permission to modify this exercise");
    this.name = "ExerciseForbiddenError";
  }
}

export async function createExercise(userId: string, input: ExerciseInput) {
  return prisma.exercise.create({
    data: { ...input, ownerId: userId },
  });
}

export async function listExercisesForUser(userId: string) {
  return prisma.exercise.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    orderBy: { createdAt: "asc" },
  });
}

export async function getExerciseById(userId: string, id: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });

  if (!exercise || (exercise.ownerId !== null && exercise.ownerId !== userId)) {
    throw new ExerciseNotFoundError();
  }

  return exercise;
}

export async function updateExercise(userId: string, id: string, input: Partial<ExerciseInput>) {
  const exercise = await getExerciseById(userId, id);

  if (exercise.ownerId !== userId) {
    throw new ExerciseForbiddenError();
  }

  return prisma.exercise.update({ where: { id }, data: input });
}

export async function deleteExercise(userId: string, id: string) {
  const exercise = await getExerciseById(userId, id);

  if (exercise.ownerId !== userId) {
    throw new ExerciseForbiddenError();
  }

  await prisma.exercise.delete({ where: { id } });
}
