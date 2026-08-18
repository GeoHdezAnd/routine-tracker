import { Router } from "express";
import * as z from "zod";
import { requireAuth } from "../middleware/require-auth.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  calculateAge,
  getUserById,
  loginUser,
  registerUser,
} from "../services/auth.service.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  birthDate: z.iso.date().optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const user = await registerUser(parsed.data.email, parsed.data.password, {
      name: parsed.data.name,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
    });
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

authRouter.get("/me", requireAuth, async (_req, res) => {
  const user = await getUserById(res.locals.userId);
  const age = user?.birthDate ? calculateAge(user.birthDate) : null;
  res.status(200).json({ ...user, age });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  try {
    const result = await loginUser(parsed.data.email, parsed.data.password);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
});
