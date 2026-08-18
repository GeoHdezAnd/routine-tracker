import { Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";
import { getDashboard } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (_req, res) => {
  const dashboard = await getDashboard(res.locals.userId);
  res.status(200).json(dashboard);
});
