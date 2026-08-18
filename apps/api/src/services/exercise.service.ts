import { Prisma } from "@prisma/client";
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

export class ExerciseInUseError extends Error {
  constructor() {
    super("Exercise has logged sets and cannot be deleted");
    this.name = "ExerciseInUseError";
  }
}

export async function createExercise(userId: string, input: ExerciseInput) {
  return prisma.exercise.create({
    data: { ...input, ownerId: userId },
  });
}

type ListExercisesFilters = {
  muscleGroup?: string;
  equipmentType?: string;
  movementType?: MovementType;
  limit: number;
  offset: number;
};

export async function listExercisesForUser(userId: string, filters: ListExercisesFilters) {
  const where = {
    OR: [{ ownerId: null }, { ownerId: userId }],
    ...(filters.muscleGroup ? { muscleGroup: filters.muscleGroup } : {}),
    ...(filters.equipmentType ? { equipmentType: filters.equipmentType } : {}),
    ...(filters.movementType ? { movementType: filters.movementType } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: filters.offset,
      take: filters.limit,
    }),
    prisma.exercise.count({ where }),
  ]);

  return { data, total };
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

  try {
    await prisma.exercise.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ExerciseInUseError();
    }
    throw error;
  }
}
