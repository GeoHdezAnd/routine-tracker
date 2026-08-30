import { Router } from "express";
import * as z from "zod";
import { ROUTINE_COLORS } from "@routine-tracker/shared";
import { requireAuth } from "../middleware/require-auth.js";
import { ExerciseNotFoundError } from "../services/exercise.service.js";
import {
  RoutineExerciseNotFoundError,
  RoutineNotFoundError,
  addExerciseToRoutine,
  addRoutineToPlan,
  createRoutine,
  deleteRoutine,
  getRoutineById,
  listRoutinesForUser,
  removeExerciseFromRoutine,
  removeRoutineFromPlan,
  suggestRepRange,
  updateRoutine,
  updateRoutineExercise,
} from "../services/routine.service.js";

export const routinesRouter = Router();

const movementTypeEnum = z.enum(["COMPOUND", "ISOLATION"]);
const goalEnum = z.enum(["STRENGTH", "HYPERTROPHY", "ENDURANCE"]);

const dayOfWeekEnum = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

const routineSchema = z.object({
  name: z.string().min(1),
  color: z.enum(ROUTINE_COLORS).optional(),
  muscleGroups: z.array(z.string().min(1)).optional(),
  trainingDays: z.array(dayOfWeekEnum).optional(),
});
const updateRoutineSchema = routineSchema.partial().extend({
  archived: z.boolean().optional(),
});

const listRoutinesQuerySchema = z.object({
  archived: z.enum(["true", "false"]).optional(),
});

const addRoutineExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  order: z.number().int(),
  supersetSlot: z.number().int().nullable().optional(),
  goal: goalEnum,
  targetSets: z.number().int().positive(),
  targetRepMin: z.number().int().positive().optional(),
  targetRepMax: z.number().int().positive().optional(),
});

const updateRoutineExerciseSchema = z.object({
  order: z.number().int().optional(),
  supersetSlot: z.number().int().nullable().optional(),
  goal: goalEnum.optional(),
  targetSets: z.number().int().positive().optional(),
  targetRepMin: z.number().int().positive().optional(),
  targetRepMax: z.number().int().positive().optional(),
});

const repRangeQuerySchema = z.object({
  movementType: movementTypeEnum,
  goal: goalEnum,
});

routinesRouter.use(requireAuth);

routinesRouter.get("/rep-range-suggestion", (req, res) => {
  const parsed = repRangeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  res.status(200).json(suggestRepRange(parsed.data.movementType, parsed.data.goal));
});

routinesRouter.post("/", async (req, res) => {
  const parsed = routineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const routine = await createRoutine(res.locals.userId, parsed.data);
  res.status(201).json(routine);
});

routinesRouter.get("/", async (req, res) => {
  const parsed = listRoutinesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const routines = await listRoutinesForUser(res.locals.userId, parsed.data.archived === "true");
  res.status(200).json(routines);
});

routinesRouter.get("/:id", async (req, res) => {
  try {
    const routine = await getRoutineById(res.locals.userId, req.params.id);
    res.status(200).json(routine);
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.patch("/:id", async (req, res) => {
  const parsed = updateRoutineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const routine = await updateRoutine(res.locals.userId, req.params.id, parsed.data);
    res.status(200).json(routine);
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.delete("/:id", async (req, res) => {
  try {
    await deleteRoutine(res.locals.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.post("/:id/plan", async (req, res) => {
  try {
    const period = await addRoutineToPlan(res.locals.userId, req.params.id);
    res.status(200).json(period);
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.delete("/:id/plan", async (req, res) => {
  try {
    await removeRoutineFromPlan(res.locals.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.post("/:id/exercises", async (req, res) => {
  const parsed = addRoutineExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const routineExercise = await addExerciseToRoutine(res.locals.userId, req.params.id, parsed.data);
    res.status(201).json(routineExercise);
  } catch (error) {
    if (error instanceof RoutineNotFoundError || error instanceof ExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.patch("/:id/exercises/:routineExerciseId", async (req, res) => {
  const parsed = updateRoutineExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const routineExercise = await updateRoutineExercise(
      res.locals.userId,
      req.params.id,
      req.params.routineExerciseId,
      parsed.data,
    );
    res.status(200).json(routineExercise);
  } catch (error) {
    if (error instanceof RoutineNotFoundError || error instanceof RoutineExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

routinesRouter.delete("/:id/exercises/:routineExerciseId", async (req, res) => {
  try {
    await removeExerciseFromRoutine(res.locals.userId, req.params.id, req.params.routineExerciseId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof RoutineNotFoundError || error instanceof RoutineExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});
