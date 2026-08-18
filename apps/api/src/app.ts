import express from "express";
import { rateLimit } from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { exercisesRouter } from "./routes/exercises.js";
import { routinesRouter } from "./routes/routines.js";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());

  const globalLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
  });

  app.use(globalLimiter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authLimiter, authRouter);
  app.use("/exercises", exercisesRouter);
  app.use("/routines", routinesRouter);

  return app;
}
