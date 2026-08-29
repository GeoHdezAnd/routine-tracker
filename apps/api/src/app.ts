import * as z from "zod";
import { es } from "zod/locales";
import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { exercisesRouter } from "./routes/exercises.js";
import { routinesRouter } from "./routes/routines.js";
import { sessionsRouter } from "./routes/sessions.js";

z.config(es());

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const RATE_LIMIT_MESSAGE = "Demasiadas solicitudes, intente nuevamente más tarde.";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json());

  function createResourceLimiter() {
    return rateLimit({
      windowMs: FIFTEEN_MINUTES,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: RATE_LIMIT_MESSAGE },
    });
  }

  const authLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: RATE_LIMIT_MESSAGE },
    skip: () => process.env.NODE_ENV === "test",
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authLimiter, authRouter);
  app.use("/exercises", createResourceLimiter(), exercisesRouter);
  app.use("/routines", createResourceLimiter(), routinesRouter);
  app.use("/sessions", createResourceLimiter(), sessionsRouter);
  app.use("/dashboard", createResourceLimiter(), dashboardRouter);

  return app;
}
