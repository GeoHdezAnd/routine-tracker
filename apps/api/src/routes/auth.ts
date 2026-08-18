import { Router } from "express";
import * as z from "zod";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  loginUser,
  registerUser,
} from "../services/auth.service.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
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
    const user = await registerUser(parsed.data.email, parsed.data.password);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
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
