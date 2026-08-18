import { Router } from "express";
import * as z from "zod";
import { requireAuth } from "../middleware/require-auth.js";
import { ExerciseNotFoundError } from "../services/exercise.service.js";
import { RoutineNotFoundError } from "../services/routine.service.js";
import {
  SessionAlreadyFinishedError,
  SessionNotFoundError,
  SetLogNotFoundError,
  addSetLog,
  createSession,
  deleteSession,
  deleteSetLog,
  finishSession,
  getSessionById,
  listSessionsForUser,
  updateSetLog,
} from "../services/workout-session.service.js";

export const sessionsRouter = Router();

const createSessionSchema = z.object({
  routineId: z.string().min(1).optional(),
});

const addSetLogSchema = z.object({
  exerciseId: z.string().min(1),
  weightKg: z.number().positive(),
  reps: z.number().int().positive(),
  rir: z.number().int().min(0).max(5).nullable().optional(),
  note: z.string().optional(),
});

const updateSetLogSchema = z.object({
  weightKg: z.number().positive().optional(),
  reps: z.number().int().positive().optional(),
  rir: z.number().int().min(0).max(5).nullable().optional(),
  note: z.string().optional(),
});

sessionsRouter.use(requireAuth);

sessionsRouter.post("/", async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const session = await createSession(res.locals.userId, parsed.data);
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

sessionsRouter.get("/", async (_req, res) => {
  const sessions = await listSessionsForUser(res.locals.userId);
  res.status(200).json(sessions);
});

sessionsRouter.get("/:id", async (req, res) => {
  try {
    const session = await getSessionById(res.locals.userId, req.params.id);
    res.status(200).json(session);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

sessionsRouter.post("/:id/finish", async (req, res) => {
  try {
    const session = await finishSession(res.locals.userId, req.params.id);
    res.status(200).json(session);
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof SessionAlreadyFinishedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

sessionsRouter.delete("/:id", async (req, res) => {
  try {
    await deleteSession(res.locals.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
});

sessionsRouter.post("/:id/logs", async (req, res) => {
  const parsed = addSetLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const log = await addSetLog(res.locals.userId, req.params.id, parsed.data);
    res.status(201).json(log);
  } catch (error) {
    if (error instanceof SessionNotFoundError || error instanceof ExerciseNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof SessionAlreadyFinishedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

sessionsRouter.patch("/:id/logs/:logId", async (req, res) => {
  const parsed = updateSetLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const log = await updateSetLog(res.locals.userId, req.params.id, req.params.logId, parsed.data);
    res.status(200).json(log);
  } catch (error) {
    if (error instanceof SessionNotFoundError || error instanceof SetLogNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof SessionAlreadyFinishedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

sessionsRouter.delete("/:id/logs/:logId", async (req, res) => {
  try {
    await deleteSetLog(res.locals.userId, req.params.id, req.params.logId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof SessionNotFoundError || error instanceof SetLogNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    if (error instanceof SessionAlreadyFinishedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});
