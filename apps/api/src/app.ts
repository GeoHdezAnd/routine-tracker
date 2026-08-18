import express from "express";
import { authRouter } from "./routes/auth.js";
import { exercisesRouter } from "./routes/exercises.js";
import { routinesRouter } from "./routes/routines.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/exercises", exercisesRouter);
  app.use("/routines", routinesRouter);

  return app;
}
