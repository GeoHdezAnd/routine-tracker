import { Router } from "express";
import * as z from "zod";
import { requireAuth } from "../middleware/require-auth.js";
import {
  ExerciseForbiddenError,
  ExerciseNotFoundError,
  createExercise,
  deleteExercise,
  getExerciseById,
  listExercisesForUser,
  updateExercise,
} from "../services/exercise.service.js";

export const exercisesRouter = Router();

const exerciseSchema = z.object({
  name: z.string().min(1),
  muscleGroup: z.string().min(1),
  equipmentType: z.string().min(1),
  movementType: z.enum(["COMPOUND", "ISOLATION"]),
});

const updateExerciseSchema = exerciseSchema.partial();

exercisesRouter.use(requireAuth);

exercisesRouter.post("/", async (req, res) => {
  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const exercise = await createExercise(res.locals.userId, parsed.data);
  res.status(201).json(exercise);
});

exercisesRouter.get("/", async (_req, res) => {
  const exercises = await listExercisesForUser(res.locals.userId);
  res.status(200).json(exercises);
});

exercisesRouter.get("/:id", async (req, res) => {
  try {
    const exercise = await getExerciseById(res.locals.userId, req.params.id);
    res.status(200).json(exercise);
  } catch (error) {
    if (error instanceof ExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

exercisesRouter.patch("/:id", async (req, res) => {
  const parsed = updateExerciseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const exercise = await updateExercise(res.locals.userId, req.params.id, parsed.data);
    res.status(200).json(exercise);
  } catch (error) {
    if (error instanceof ExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof ExerciseForbiddenError) {
      res.status(403).json({ error: error.message });
      return;
    }
    throw error;
  }
});

exercisesRouter.delete("/:id", async (req, res) => {
  try {
    await deleteExercise(res.locals.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof ExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof ExerciseForbiddenError) {
      res.status(403).json({ error: error.message });
      return;
    }
    throw error;
  }
});
