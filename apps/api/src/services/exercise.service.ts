import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getPersonalRecordsForExercises } from "./set-log.utils.js";

type MovementType = "COMPOUND" | "ISOLATION";

type ExerciseInput = {
  name: string;
  muscleGroup: string;
  equipmentType: string;
  movementType: MovementType;
  imageUrl?: string;
};

export class ExerciseNotFoundError extends Error {
  constructor() {
    super("Ejercicio no encontrado");
    this.name = "ExerciseNotFoundError";
  }
}

export class ExerciseForbiddenError extends Error {
  constructor() {
    super("No tiene permiso para modificar este ejercicio");
    this.name = "ExerciseForbiddenError";
  }
}

export class ExerciseInUseError extends Error {
  constructor() {
    super("El ejercicio tiene series registradas y no se puede eliminar");
    this.name = "ExerciseInUseError";
  }
}

export async function createExercise(userId: string, input: ExerciseInput) {
  return prisma.exercise.create({
    data: { ...input, ownerId: userId },
  });
}

type ListExercisesFilters = {
  muscleGroup?: string | string[];
  equipmentType?: string;
  movementType?: MovementType;
  limit: number;
  offset: number;
};

function muscleGroupFilter(muscleGroup: string | string[] | undefined) {
  if (!muscleGroup || (Array.isArray(muscleGroup) && muscleGroup.length === 0)) return {};
  if (Array.isArray(muscleGroup)) {
    return muscleGroup.length > 1 ? { muscleGroup: { in: muscleGroup } } : { muscleGroup: muscleGroup[0]! };
  }
  return { muscleGroup };
}

export async function getDistinctMuscleGroups(userId: string) {
  const rows = await prisma.exercise.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { muscleGroup: true },
    distinct: ["muscleGroup"],
  });
  return rows.map((row) => row.muscleGroup).sort((a, b) => a.localeCompare(b));
}

export async function listExercisesForUser(userId: string, filters: ListExercisesFilters) {
  const where = {
    OR: [{ ownerId: null }, { ownerId: userId }],
    ...muscleGroupFilter(filters.muscleGroup),
    ...(filters.equipmentType ? { equipmentType: filters.equipmentType } : {}),
    ...(filters.movementType ? { movementType: filters.movementType } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.exercise.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: filters.offset,
      take: filters.limit,
    }),
    prisma.exercise.count({ where }),
  ]);

  const personalRecords = await getPersonalRecordsForExercises(
    userId,
    rows.map((exercise) => exercise.id),
  );
  const data = rows.map((exercise) => ({
    ...exercise,
    personalRecord: personalRecords.get(exercise.id) ?? null,
  }));

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
